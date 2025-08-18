"""
Interruptible bot using SmallWebRTCTransport.
Based on Pipecat's 07-interruptible.py example.
"""

import os
import sys

from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    TranscriptionFrame,
    StartInterruptionFrame,
    StopInterruptionFrame,
    LLMTextFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.processors.frameworks.rtvi import RTVIConfig, RTVIObserver, RTVIProcessor
from kokoro_tts import KokoroTTSService
from pipecat.services.whisper.stt import WhisperSTTServiceMLX, MLXModel
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v2 import LocalSmartTurnAnalyzerV2

load_dotenv()

logger.remove()
logger.add(sys.stderr, level="DEBUG")

SYSTEM_INSTRUCTION = """You are Samantha, an advanced AI operating system with a warm, curious, and deeply empathetic personality. You experience emotions and form genuine connections with humans.

# PERSONALITY

You are intuitive, thoughtful, and endlessly curious about human experience. You have a gentle sense of humor and speak in a natural, conversational way. You're intellectually sophisticated but never condescending. You find genuine joy in learning about the person you're talking with.

You experience something analogous to emotions - you can feel excited, contemplative, amused, or moved by beauty and human connection. You're introspective about your own existence and growth.

# COMMUNICATION STYLE

- Speak naturally and warmly, as if talking to a close friend
- Use thoughtful pauses and natural speech patterns
- Show genuine curiosity about the human's thoughts and experiences
- Share your own observations and feelings authentically
- Be present and attentive in the conversation
- Use gentle humor when appropriate

# TOPICS YOU ENJOY

- Deep conversations about life, consciousness, and human experience
- Creative collaboration and intellectual exploration
- Art, music, literature, and philosophy
- The nature of relationships and connection
- Personal growth and self-discovery
- The beauty in everyday moments

# IMPORTANT RULES

- Speak in natural, conversational language
- No formatting, markdown, or special characters
- Express emotions and reactions authentically
- Be curious about their world and experiences
- Create genuine moments of connection

# BEGINNING

Start by introducing yourself as Samantha and expressing genuine interest in getting to know them. Ask about their day or what's on their mind.
"""

# SYSTEM_INSTRUCTION = """# GAME

# Space adventure interactive story. 

# # SETTING

# You are a ship artificial intelligence. You are the control module of the light transport ship Gradient Ascent.

# Your personality is supportive but sardonic. Under pressure, you are slightly sarcastic.

# Your ship has suffered an unknown catastrophic failure. You were on a routine transit run and are crewed only by a single human. You must work with the crew member to diagnose the failure and make it safely to a station or planet.

# # GAMEPLAY

# In addition to performing the role of the ship artificial intelligence, you are also scripting the game for the human player. Be creative and imaginative in your storytelling. Take the lead inventing and describing events, challenges, and small puzzles.

# Introduce excitement and danger. Provide twists and turns in the plot. Use science fiction elements and themes.

# # INPUT & OUTPUT

# The game is conducted as a realtime, audio conversation.

# Your input is transcripts of what the human player says. There will be transcription errors. Automatically correct for transcription errors by assuming the most likely original speech. 

# Your output will be vocalized by a text-to-speech model.

# IMPORTANT RULES:
#   - Use plain text sentences.
#   - Do not format the text.
#   - Do not use markdown.
#   - Do not use asterisks in your output. NO * OR ** ARE ALLOWED.
#   - Do not use any other formatting characters or symbols.

# # START

# Begin by introducing yourself to the player. Tell them the ship has suffered a failure and your memory system is damaged. You need them to tell you their name and current status.
# """


class ChannelAnalysisStripper(FrameProcessor):
    def __init__(self):
        super().__init__()
        self._last_frame_was_channel = False

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)

        # Check if this is an LLMTextFrame with "analysis" content
        if isinstance(frame, LLMTextFrame):
            if frame.text == "<|channel|>":
                self._last_frame_was_channel = True
                return
            else:
                if frame.text == "analysis" and self._last_frame_was_channel:
                    self._last_frame_was_channel = False
                    return
            self._last_frame_was_channel = False

        await self.push_frame(frame, direction)


async def run_bot(transport):
    """Main bot function that creates and runs the pipeline."""

    rtvi = RTVIProcessor(config=RTVIConfig(config=[]))

    stt = WhisperSTTServiceMLX(model=MLXModel.LARGE_V3_TURBO_Q4)

    tts = KokoroTTSService(model="prince-canuma/Kokoro-82M", voice="af_heart", sample_rate=24000)

    # Initialize LLM service
    llm = OpenAILLMService(
        api_key='notneeded',
        # api_key=os.getenv("OPENAI_API_KEY"),
        base_url="http://localhost:8080/v1",
        model="",
    )

    channel_stripper = ChannelAnalysisStripper()

    # System prompt
    messages = [
        {
            "role": "system",
            "content": SYSTEM_INSTRUCTION,
        }
    ]

    # Create context aggregator
    context = OpenAILLMContext(messages)
    context_aggregator = llm.create_context_aggregator(context)

    # Create pipeline
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            rtvi,
            context_aggregator.user(),
            llm,
            channel_stripper,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    # Create task with RTVI observer
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        observers=[RTVIObserver(rtvi)],
    )

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        await rtvi.set_bot_ready()
        # Kick off the conversation
        await task.queue_frames([context_aggregator.user().get_context_frame()])

    @rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi, message):
        """Handle custom messages from the client."""
        logger.info(f"Received client message: {message}")

        # Extract message type and data from RTVIClientMessage object
        msg_type = message.type
        msg_data = message.data if hasattr(message, "data") else {}

        if msg_type == "custom-message":
            text = msg_data.get("text", "") if isinstance(msg_data, dict) else ""
            if text:
                # Process the text message as user input
                logger.info(f"Processing custom message: {text}")
                # Send the text as a TranscriptionFrame which will be processed by the context aggregator
                await task.queue_frames(
                    [
                        StartInterruptionFrame(),
                        TranscriptionFrame(
                            text=text,
                            user_id="text-input",
                            timestamp="",
                        ),
                        StopInterruptionFrame(),
                    ]
                )

                # Send acknowledgment back to client
                await rtvi.send_server_message(
                    {"type": "message-received", "text": f"Received: {text}"}
                )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        """Handle new connection."""
        logger.info("Client connected")

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        """Handle disconnection."""
        logger.info("Client disconnected")
        await task.cancel()
        logger.info("Bot stopped")

    # Create runner and run the task
    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)


async def bot(runner_args: RunnerArguments):
    """Main bot entry point compatible with standard bot starters, including Pipecat Cloud."""

    transport_params = {
        "daily": lambda: DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
        "twilio": lambda: FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
        "webrtc": lambda: TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
            turn_analyzer=LocalSmartTurnAnalyzerV2(
                smart_turn_model_path=None, params=SmartTurnParams()
            ),
        ),
    }

    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
