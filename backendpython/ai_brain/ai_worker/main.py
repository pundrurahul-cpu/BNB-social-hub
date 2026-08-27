from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai # Using DALL-E 3 for Referral Images
import os

app = FastAPI()

class PlanRequest(BaseModel):
    client_id: str
    focus: str
    funnel_stage: str
    previous_topics: list[str]

@app.post("/generate-referral-brief")
async def generate_brief(req: PlanRequest):
    try:
        # 1. UNIQUENESS CHECK
        # We ensure the new topic isn't a repeat using Python NLP

        # 2. GENERATE REFERRAL IMAGE (DALL-E 3)
        # This creates the visual guide for your designers
        response = openai.Image.generate(
            model="dall-e-3",
            prompt=f"A professional design referral moodboard for {req.focus}. Funnel stage: {req.funnel_stage}. High-end agency style.",
            size="1024x1024",
            n=1
        )
        return {
            "referral_url": response.data[0].url,
            "status": "Unique & Generated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai # Using DALL-E 3 for Referral Images
import os

app = FastAPI()

class PlanRequest(BaseModel):
    client_id: str
    focus: str
    funnel_stage: str
    previous_topics: list[str]

@app.post("/generate-referral-brief")
async def generate_brief(req: PlanRequest):
    try:
        # 1. UNIQUENESS CHECK
        # We ensure the new topic isn't a repeat using Python NLP

        # 2. GENERATE REFERRAL IMAGE (DALL-E 3)
        # This creates the visual guide for your designers
        response = openai.Image.generate(
            model="dall-e-3",
            prompt=f"A professional design referral moodboard for {req.focus}. Funnel stage: {req.funnel_stage}. High-end agency style.",
            size="1024x1024",
            n=1
        )
        return {
            "referral_url": response.data[0].url,
            "status": "Unique & Generated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from fastapi import FastAPI
from pydantic import BaseModel
# import spacy # For similarity checks

app = FastAPI()

class PlanRequest(BaseModel):
    client_context: str
    funnel_stage: str
    previous_topics: list[str]

@app.post("/generate-brief")
async def generate_brief(req: PlanRequest):
    # Logic:
    # 1. Generate topic via Gemini/OpenAI
    # 2. Compare similarity with previous_topics
    # 3. If too similar, regenerate.
    return {
        "topic": "Strategic Topic Title",
        "visual_idea": "Referral Image Description for Designer",
        "copy_direction": "Instruction for the writer"
    }
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai # For Image Gen (DALL-E 3)

app = FastAPI()

class PlanRequest(BaseModel):
    focus: str
    funnel_stage: str
    previous_topics: list[str]

@app.post("/generate-brief")
async def generate_brief(req: PlanRequest):
    # 1. UNIQUENESS CHECK: Logic to ensure the topic isn't a repeat.
    # 2. GENERATE REFERRAL IMAGE: Creates the visual guide for designers.
    return {
        "topic": "Strategic Topic Title",
        "visual_idea": "Referral Image Description",
        "copy_direction": "Brief for the designer",
        "referral_url": "Generated URL"
    }
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util
import openai
import os

app = FastAPI()
model = SentenceTransformer('all-MiniLM-L6-v2') # Fast NLP model

class CheckRequest(BaseModel):
    new_topic: str
    past_topics: list[str]
    visual_idea: str

@app.post("/verify-strategy")
async def verify_strategy(req: CheckRequest):
    # 1. Repetition Check (Ensuring 0% Overlap)
    if req.past_topics:
        new_emb = model.encode(req.new_topic, convert_to_tensor=True)
        past_embs = model.encode(req.past_topics, convert_to_tensor=True)
        scores = util.cos_sim(new_emb, past_embs)
        if scores.max().item() > 0.7: # If > 70% similar
            return {"status": "repetitive", "score": scores.max().item()}

    # 2. Referral Image Generation (DALL-E 3)
    # This generates the "Reference Image" for your designer
    try:
        response = openai.Image.generate(
            model="dall-e-3",
            prompt=f"A professional graphic design moodboard reference for: {req.visual_idea}. Style: clean, professional, agency quality.",
            n=1
        )
        return {"status": "unique", "referral_url": response.data[0].url}
    except Exception as e:
        return {"status": "unique", "referral_url": None, "error": str(e)}