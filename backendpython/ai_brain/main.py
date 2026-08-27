from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util
import openai
import os
from dotenv import load_dotenv

# Load environment variables from the server's .env file
# Assuming main.py is in server/ai engine/ai_brain/
load_dotenv(dotenv_path="../../../.env")

app = FastAPI()

# Set OpenAI Key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Load a small, fast model for repetition checking
# This might take a moment on first run to download the model
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Error loading SentenceTransformer: {e}")
    model = None

class StrategyRequest(BaseModel):
    client_id: str
    funnel_stage: str
    topic: str
    visual_idea: str
    previous_topics: list[str]

@app.post("/verify-and-visualize")
async def verify_and_visualize(req: StrategyRequest):
    # 1. UNIQUENESS CHECK (0% Repetition Logic)
    similarity_score = 0.0
    if model and req.previous_topics:
        try:
            embeddings1 = model.encode(req.topic, convert_to_tensor=True)
            embeddings2 = model.encode(req.previous_topics, convert_to_tensor=True)
            cosine_scores = util.cos_sim(embeddings1, embeddings2)

            # If any previous topic is more than 75% similar, we flag it
            similarity_score = float(cosine_scores.max().item())
            if similarity_score > 0.75:
                return {
                    "status": "repetitive",
                    "similarity": similarity_score,
                    "referral_url": None
                }
        except Exception as e:
            print(f"Similarity check failed: {e}")

    # 2. REFERRAL IMAGE GENERATION (DALL-E 3)
    try:
        if not openai.api_key:
            return {
                "status": "unique",
                "referral_url": None,
                "error": "OpenAI API Key missing",
                "similarity": similarity_score
            }

        response = openai.Image.generate(
            model="dall-e-3",
            prompt=f"A professional graphic design referral moodboard for a social media post. Funnel Stage: {req.funnel_stage}. Topic: {req.topic}. Visual Idea: {req.visual_idea}. Clean, modern agency style.",
            size="1024x1024",
            n=1
        )
        return {
            "status": "unique",
            "referral_url": response.data[0].url,
            "similarity": similarity_score
        }
    except Exception as e:
        return {
            "status": "unique",
            "referral_url": None,
            "error": str(e),
            "similarity": similarity_score
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
