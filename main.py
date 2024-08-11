import time
from typing import List
from modules.typings import Interaction
import os
from datetime import datetime
from assistants.assistants import AssElevenPAF, GroqElevenPAF, OpenAIPAF
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS, cross_origin
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

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)
load_dotenv()

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

@app.route('/api/generate_title', methods=['POST', 'OPTIONS'])
@cross_origin(origin='http://localhost:3000', supports_credentials=True)
def generate_title():
    if request.method == 'OPTIONS':
        return '', 204
    global assistant
    try:
        app.logger.info(f"Received request: {request.method} {request.url}")
        app.logger.info(f"Request headers: {request.headers}")
        app.logger.info(f"Request body: {request.get_data(as_text=True)}")
        
        messages = request.json.get('messages', [])
        if not messages or not isinstance(messages, list):
            app.logger.warning("No messages received or invalid format")
            return jsonify({'title': 'New Conversation'})

        # Combine all messages into a single string
        conversation = " ".join([msg.get('text', '') for msg in messages])

        # Generate a summary using the AI assistant
        if assistant is None:
            assistant = initialize_assistant()

        prompt = CONVERSATION_NAMING_PROMPT.format(conversation=conversation)

        title = assistant.think(prompt).strip()

        # Ensure the title is not too long
        max_title_length = 50
        if len(title) > max_title_length:
            title = title[:max_title_length].strip() + '...'

        return jsonify({'title': title})
    except Exception as e:
        app.logger.error(f"Error generating title: {str(e)}")
        return jsonify({'error': 'Failed to generate title', 'details': str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
