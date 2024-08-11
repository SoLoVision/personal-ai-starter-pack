import time
from typing import List
from modules.typings import Interaction
import os
from datetime import datetime
from assistants.assistants import AssElevenPAF, GroqElevenPAF, OpenAIPAF
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
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


# Removed unused functions


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

        # Generate audio from the response
        audio_data = assistant.generate_voice_audio(response)
        
        # Create an in-memory file-like object
        audio_io = io.BytesIO(audio_data)
        audio_io.seek(0)

        # Update previous interactions
        previous_interactions.append(Interaction(role="human", content=transcription))
        previous_interactions.append(Interaction(role="assistant", content=response))
        logger.info("Updated previous interactions.")

        # Keep only the last CONVO_TRAIL_CUTOFF interactions
        if len(previous_interactions) > CONVO_TRAIL_CUTOFF:
            previous_interactions = previous_interactions[-CONVO_TRAIL_CUTOFF:]

        return send_file(
            audio_io,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name="response.mp3"
        )
    except Exception as e:
        logger.error(f"An error occurred during transcription: {e}")
        return jsonify({"error": "An error occurred during transcription"}), 500
    finally:
        if os.path.exists(filename):
            os.remove(filename)
            logger.info("Audio file removed.")


@app.route('/api/get_last_interaction', methods=['GET'])
def get_last_interaction():
    if len(previous_interactions) >= 2:
        last_human = previous_interactions[-2]
        last_ai = previous_interactions[-1]
        return jsonify({
            "transcription": last_human.content,
            "response": last_ai.content
        })
    else:
        return jsonify({"error": "No interactions available"}), 404

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
