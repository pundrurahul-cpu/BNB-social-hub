# Walkthrough - Quote Image Generation Feature

I have successfully added the **Funnel-Based Quote Image Generation** feature to the BNB Social Hub. This allows you to generate professional social media graphics with your expert copy embedded as a quote, automatically styled to match the post's funnel stage.

## Key Changes

### Backend
- **New Logic:** Implemented `generateQuoteGraphic` in `imageService.js`. It uses DALL-E 3 with specialized prompts that consider the `funnel_stage`, `topic`, and `content`.
- **New Route:** Added `POST /api/posts/:id/generate-quote-graphic` to handle the generation requests.

### Frontend
- **Enhanced Strategy Planner:** Added a new **"Generate Quote Graphic"** button (rose-colored) in the Visual Idea column.
- **Dynamic Styling:** The AI automatically adjusts the typography and background based on the funnel stage:
    - **Awareness:** Bold, attention-grabbing.
    - **Trust:** Elegant and sophisticated.
    - **Conversion:** Clean and focal-point oriented.

## How to use the new feature
1.  Navigate to the **Strategy Brain** page.
2.  Find a post in your roadmap.
3.  Click the **"Generate Quote Graphic"** button.
4.  The system will use DALL-E 3 to craft a professional graphic containing the post's expert copy.
5.  Once generated, the image will appear in the list and be saved to the post automatically.

## Verification Summary
- **Backend:** Verified that the new route correctly calls the DALL-E 3 service and updates the database.
- **UI:** Verified that the new buttons appear, show loading states, and correctly display the generated images.
