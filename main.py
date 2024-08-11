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
    CONVERSATION_NAMING_PROMPT,
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


@app.route('/api/process_input', methods=['POST'])
def process_input():
    """
    Process the input, whether it's audio or text.
    """
    global previous_interactions, assistant
    logger.info("Received request to /api/process_input")
    
    audio_enabled = request.form.get('audio_enabled', 'true').lower() == 'true'
    is_new_conversation = request.form.get('is_new_conversation', 'false').lower() == 'true'
    
    if 'audio' in request.files:
        audio_file = request.files['audio']
        filename = f"audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
        audio_file.save(filename)
        logger.info(f"Audio file {filename} saved.")
        
        try:
            if assistant is None:
                assistant = initialize_assistant()
            
            transcription = assistant.transcribe(filename)
            logger.info(f"Transcription complete: {transcription}")
            user_input = transcription
        finally:
            if os.path.exists(filename):
                os.remove(filename)
                logger.info("Audio file removed.")
    elif 'text' in request.form:
        user_input = request.form['text']
        logger.info(f"Received text input: {user_input}")
    else:
        return jsonify({"error": "No input provided"}), 400

    try:
        if assistant is None:
            assistant = initialize_assistant()

        prompt = build_prompt(user_input, previous_interactions)
        logger.info("Generating response from AI assistant...")
        response = assistant.think(prompt)
        logger.info(f"AI assistant response: {response}")

        # Update previous interactions
        previous_interactions.append(Interaction(role="human", content=user_input))
        previous_interactions.append(Interaction(role="assistant", content=response))
        logger.info("Updated previous interactions.")

        # Keep only the last CONVO_TRAIL_CUTOFF interactions
        if len(previous_interactions) > CONVO_TRAIL_CUTOFF:
            previous_interactions = previous_interactions[-CONVO_TRAIL_CUTOFF:]

        # Generate conversation name if it's a new conversation
        conversation_name = None
        if is_new_conversation:
            naming_prompt = CONVERSATION_NAMING_PROMPT.format(conversation=user_input + "\n" + response)
            conversation_name = assistant.think(naming_prompt).strip()

        if audio_enabled:
            # Generate audio from the response
            audio_data = assistant.generate_voice_audio(response)
            
            # Create an in-memory file-like object
            audio_io = io.BytesIO(audio_data)
            audio_io.seek(0)

            return send_file(
                audio_io,
                mimetype="audio/mpeg",
                as_attachment=True,
                download_name="response.mp3"
            ), 200, {'X-Conversation-Name': conversation_name}
        else:
            return jsonify({"response": response, "conversation_name": conversation_name})
    except Exception as e:
        logger.error(f"An error occurred during processing: {e}")
        return jsonify({"error": "An error occurred during processing"}), 500

def initialize_assistant():
    if ASSISTANT_TYPE == "AssElevenPAF":
        assistant = AssElevenPAF()
    elif ASSISTANT_TYPE == "GroqElevenPAF":
        assistant = GroqElevenPAF()
    elif ASSISTANT_TYPE == "OpenAIPAF":
        assistant = OpenAIPAF()
    else:
        raise ValueError(f"Unknown assistant type: {ASSISTANT_TYPE}")
    assistant.setup()
    return assistant


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

@app.route('/api/generate_title', methods=['POST'])
def generate_title():
    try:
        messages = request.json['messages']
        if not messages:
            return jsonify({'title': 'New Conversation'})

        # Use the first message as the basis for the title
        first_message = messages[0]['text']
        
        # Truncate the message if it's too long
        max_title_length = 50
        title = first_message[:max_title_length].strip()
        
        # Add ellipsis if the title was truncated
        if len(first_message) > max_title_length:
            title += '...'

        return jsonify({'title': title})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
