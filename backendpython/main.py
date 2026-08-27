from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import openai
import os
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer, util

# Load credentials from .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(title="BNB Strategic AI Brain")

# Load a fast NLP model for repetition checking
# This is much more efficient than Node.js for text analysis
model = SentenceTransformer('all-MiniLM-L6-v2')

class StrategyRequest(BaseModel):
    new_topic: str
    previous_topics: List[str]
    visual_idea: str
    client_focus: str

@app.post("/analyze-strategy")
async def analyze_strategy(req: StrategyRequest):
    """
    1. Uniqueness Check: Ensures the new idea doesn't repeat old ones.
    2. Referral Generation: Creates a moodboard image for the designer.
    """
    try:
        # Step 1: Check Similarity ( Repetition Guard )
        if req.previous_topics:
            new_emb = model.encode(req.new_topic, convert_to_tensor=True)
            past_embs = model.encode(req.previous_topics, convert_to_tensor=True)
            cosine_scores = util.cos_sim(new_emb, past_embs)

            # If similarity > 75%, it's considered a repeat
            max_sim = cosine_scores.max().item()
            if max_sim > 0.75:
                return {"status": "repetitive", "score": max_sim}

        # Step 2: Generate Referral Image for Designer via DALL-E 3
        referral_url = None
        if os.getenv("OPENAI_API_KEY"):
            img_response = openai.Image.generate(
                model="dall-e-3",
                prompt=f"A graphic design referral moodboard for a social media post. Topic: {req.new_topic}. Visual Idea: {req.visual_idea}. Professional agency style, high-end reference.",
                n=1,
                size="1024x1024"
            )
            referral_url = img_response.data[0].url

        return {
            "status": "unique",
            "referral_image_url": referral_url,
            "similarity_score": max_sim if req.previous_topics else 0
        }
    except Exception as e:
        return {"status": "unique", "referral_image_url": None, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
