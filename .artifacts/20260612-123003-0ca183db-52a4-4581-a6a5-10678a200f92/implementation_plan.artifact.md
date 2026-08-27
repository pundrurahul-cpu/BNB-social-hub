# Implementation Plan - Funnel-Based Quote Image Generation

This plan adds a feature to generate professional social media graphics with quotes/text directly on the image, based on the post's funnel stage, topic, and expert copy.

## User Review Required

> [!IMPORTANT]
> - **AI Model:** This feature relies on DALL-E 3 for generating high-quality visuals with text. DALL-E 3 is generally good with text but can occasionally make spelling mistakes for long sentences.
> - **Cost:** Generating high-quality DALL-E 3 images consumes OpenAI credits.

## Proposed Changes

### Backend

#### [imageService.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/server/services/imageService.js)

- Add `generateQuoteGraphic(post)` function.
- It will construct a specialized prompt for DALL-E 3 that includes:
    - The `funnel_stage` (to determine the mood/style).
    - The `topic` (for context).
    - The `content` (the actual quote/text to put on the image).
    - Styling instructions (minimalist, bold typography, professional).

#### [postRoutes.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/server/routes/postRoutes.js)

- Add `POST /api/posts/:id/generate-quote-graphic` route.
- This route will fetch the post data and call `generateQuoteGraphic`.

---

### Frontend

#### [StrategyPlanner.tsx](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/src/pages/StrategyPlanner.tsx)

- Add a new "Generate Quote Graphic" button in the "Visual Idea" column.
- Show a loading state specifically for this action.
- Update the UI to show the generated image once complete.

---

## Verification Plan

### Manual Verification
1.  **Generate Plan:** Use "Auto-Plan Month" to create placeholders with topics and expert copy.
2.  **Generate Quote:** Click the new "Generate Quote Graphic" button on a post.
3.  **Check Output:** Verify that the generated image contains the quote/text and matches the funnel stage's mood.
4.  **Persistence:** Refresh the page to ensure the image URL is saved in the database.
