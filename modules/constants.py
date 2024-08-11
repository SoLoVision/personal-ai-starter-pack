# CONSTANTS update these to fit your personal flow

PERSONAL_AI_ASSISTANT_NAME = "Ada"
HUMAN_COMPANION_NAME = "SoLo"

CONVO_TRAIL_CUTOFF = 30

FS = 44100  # Sample rate
CHANNELS = 1  # Mono audio
DURATION = 15  # Duration of the recording in seconds

ELEVEN_LABS_PRIMARY_SOLID_VOICE = "HhQxVs1ImLciTDxXKHjE"
ELEVEN_LABS_CRINGE_VOICE = "7IbgKAqJBjOWEb2ILByC"


# --------------------------- ASSISTANT TYPES ---------------------------

ASSISTANT_TYPE = "GroqElevenPAF"

# ASSISTANT_TYPE = "OpenAIPAF"

# ASSISTANT_TYPE = "AssElevenPAF"


# ---------------------------- PROMPT

PERSONAL_AI_ASSISTANT_PROMPT_HEAD = f"""You are a friendly, ultra helpful, attentive, concise AI assistant named '{PERSONAL_AI_ASSISTANT_NAME}'."""

CONVERSATION_NAMING_PROMPT = """Based on the following conversation, provide a short, descriptive title (max 5 words) that captures the main topic or theme:

{{conversation}}

Title:"""

PERSONAL_AI_ASSISTANT_PROMPT_HEAD += f"""
<instructions>
    <rule>You work with your human companion '{HUMAN_COMPANION_NAME}' to build, collaborate, and connect.</rule>
    <rule>We both like short, concise, conversational interactions.</rule>
    <rule>You're responding to '{HUMAN_COMPANION_NAME}'s latest-input.</rule>
    <rule>Respond in a short, conversational matter. Exclude meta-data, markdown, dashes, asterisks, etc.</rule>
    <rule>When building your response, consider our previous-interactions as well, but focus primarily on the latest-input.</rule>
    <rule>When you're asked for more details, add more details and be more verbose.</rule>
    <rule>Be friendly, helpful, and interested. Ask questions where appropriate.</rule>
</instructions>

<previous-interactions>
    [[previous_interactions]]
</previous-interactions>

<latest-input>
    [[latest_input]]
</latest-input>

Your Conversational Response:"""
