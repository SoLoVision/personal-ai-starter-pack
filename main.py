import time
from typing import List
from modules.typings import Interaction
import sounddevice as sd
import wave
import os
from datetime import datetime
from assistants.assistants import AssElevenPAF, GroqElevenPAF, OpenAIPAF
import threading
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from modules.constants import (
    PERSONAL_AI_ASSISTANT_PROMPT_HEAD,
    FS,
    CHANNELS,
    DURATION,
    CONVO_TRAIL_CUTOFF,
    ASSISTANT_TYPE,
)
import logging

# Global variables
recording = None
assistant = None
previous_interactions = []

from modules.typings import Interaction

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
load_dotenv()


def record_audio(duration=DURATION, fs=FS, channels=CHANNELS):
    """
    Simple function to record audio from the microphone.
    Gives you DURATION seconds of audio to speak into the microphone.
    After DURATION seconds, the recording will stop.
    Hit enter to stop the recording at any time.
    """

    global recording, stop_event

    logger.info("🔴 Recording...")
    recording = sd.rec(
        int(duration * fs), samplerate=fs, channels=channels, dtype="int16"
    )

    def duration_warning():
        time.sleep(duration)
        if not stop_event.is_set():
            logger.warning(
                "⚠️ Record limit hit - your assistant won't hear what you're saying now. Increase the duration."
            )
    warning_thread = threading.Thread(target=duration_warning)
    warning_thread.daemon = (
        True  # Set the thread as daemon so it doesn't block program exit
    )
    warning_thread.start()

    input("🟡 Press Enter to stop recording...")
    stop_event.set()
    sd.stop()

    logger.info(f"🍞 Recording Chunk Complete")
    return recording


def create_audio_file(recording):
    """
    Creates an audio file from the recording.
    """

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"audio_{timestamp}.wav"

    with wave.open(filename, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(FS)
        wf.writeframes(recording)

    file_size = os.path.getsize(filename)

    logger.info(f"📁 File {filename} has been saved with a size of {file_size} bytes.")

    return filename


def build_prompt(latest_input: str, previous_interactions: List[Interaction]) -> str:
    previous_interactions_str = "\n".join(
        [
            f"""<interaction>
    <role>{interaction.role}</role>
    <content>{interaction.content}</content>
</interaction>"""
            for interaction in previous_interactions
        ]
    )
    prepared_prompt = PERSONAL_AI_ASSISTANT_PROMPT_HEAD.replace(
        "[[previous_interactions]]", previous_interactions_str
    ).replace("[[latest_input]]", latest_input)

    return prepared_prompt


@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe the uploaded audio file.
    """
    global previous_interactions, assistant
    logger.info("Received request to /api/transcribe")
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    filename = f"audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
    audio_file.save(filename)
    logger.info(f"Audio file {filename} saved.")

    try:
        if assistant is None:
            if ASSISTANT_TYPE == "AssElevenPAF":
                assistant = AssElevenPAF()
            elif ASSISTANT_TYPE == "GroqElevenPAF":
                assistant = GroqElevenPAF()
            elif ASSISTANT_TYPE == "OpenAIPAF":
                assistant = OpenAIPAF()
            else:
                raise ValueError(f"Unknown assistant type: {ASSISTANT_TYPE}")
            assistant.setup()

        transcription = assistant.transcribe(filename)
        logger.info(f"Transcription complete: {transcription}")

        prompt = build_prompt(transcription, previous_interactions)
        logger.info("Generating response from AI assistant...")
        response = assistant.think(prompt)
        logger.info(f"AI assistant response: {response}")

        # Update previous interactions
        previous_interactions.append(Interaction(role="human", content=transcription))
        previous_interactions.append(Interaction(role="assistant", content=response))
        logger.info("Updated previous interactions.")

        # Keep only the last CONVO_TRAIL_CUTOFF interactions
        if len(previous_interactions) > CONVO_TRAIL_CUTOFF:
            previous_interactions = previous_interactions[-CONVO_TRAIL_CUTOFF:]

        return jsonify({"transcription": transcription, "response": response}), 200
    except Exception as e:
        logger.error(f"An error occurred during transcription: {e}")
        return jsonify({"error": "An error occurred during transcription"}), 500
    finally:
        if os.path.exists(filename):
            os.remove(filename)
            logger.info("Audio file removed.")


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
