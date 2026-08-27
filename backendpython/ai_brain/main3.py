from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai # Using DALL-E 3 for Referral Images
import os

app = FastAPI()

class StrategyRequest(BaseModel):
    topic: str
    visual_idea: str
    client_focus: str

@app.post("/generate-referral")
async def generate_referral(req: StrategyRequest):
    try:
        # Generates a visual reference (moodboard style) for your designer
        response = openai.Image.generate(
            model="dall-e-3",
            prompt=f"A professional graphic design moodboard for a social media post. Topic: {req.topic}. Visual Idea: {req.visual_idea}. Client Industry: {req.client_focus}. No text, just visual reference.",
            size="1024x1024",
            n=1
        )
        return {"image_url": response.data[0].url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))