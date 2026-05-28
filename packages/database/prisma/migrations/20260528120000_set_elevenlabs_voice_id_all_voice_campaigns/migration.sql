-- Set ElevenLabs voice ID for all ProdeCaballito voice campaigns.
-- Voice ID sOwJCppWuH3vZrwPgwJQ selected for its natural porteño tone.

UPDATE voice_campaigns
SET "ttsProvider" = 'elevenlabs',
    "elevenLabsVoiceId" = 'sOwJCppWuH3vZrwPgwJQ',
    "updatedAt" = NOW();
