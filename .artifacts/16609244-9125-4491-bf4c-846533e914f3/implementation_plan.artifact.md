# Implementation Plan - AI Model Reliability & Fallback Fix

The user is experiencing issues with strategy generation, resulting in "Error generating strategy details" in the UI. My investigation showed that:
1. **OpenAI** is failing with a `429` (out of credits).
2. **Gemini** is failing with a `404` (version mismatch).
3. The centralized `aiService.js` is not correctly falling back when OpenAI fails because it logs the warning but doesn't return the fallback result to the caller (it just proceeds to the next block which might also fail).

## Proposed Changes

### 1. AI Service Enhancement
#### [MODIFY] [aiService.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/aiService.js)
- Update `generateJSON` and `generateText` to ensure proper fallback chain.
- Fix Gemini model selection to use a more compatible approach (trying `v1` explicitly if needed).
- Add robust error handling to ensure we NEVER save "Error generating..." strings to the DB if we can avoid it, or at least return a sensible default.

### 2. Strategic Services Synchronization
I will update all strategic services that are still using the old direct Gemini integration to use the new centralized router. This ensures they all benefit from the OpenAI/Gemini/Ollama fallback logic.
- [MODIFY] [strategicEngineV6.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/strategicEngineV6.js)
- [MODIFY] [strategicEngineV10.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/strategicEngineV10.js)
- [MODIFY] [agencyStrategicBrain.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/agencyStrategicBrain.js)
- [MODIFY] [masterAgencyScheduler.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/masterAgencyScheduler.js)
- [MODIFY] [smartStrategicEngine.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/smartStrategicEngine.js)
- [MODIFY] [smartStrategyBrain.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/smartStrategyBrain.js)
- [MODIFY] [smartStrategyPlanner.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/smartStrategyPlanner.js)
- [MODIFY] [strategicSchedulerV9.js](file:///C:/Users/RAHUL/Downloads/BNB%20SOCIAL%20HUB%20FRONT%20END/backendjs/services/strategicSchedulerV9.js)

### 3. Cleanup
- Remove the temporary test script.

## Verification Plan
### Automated Tests
- Run the `test-router.js` script to verify that the fallback chain works correctly (e.g., if OpenAI fails, Gemini is tried, and if both fail, Ollama is tried).
- Check the console logs for "Success using..." messages.

### Manual Verification
- Ask the user to try the "Auto-Plan Month" again in the Strategy Brain.
