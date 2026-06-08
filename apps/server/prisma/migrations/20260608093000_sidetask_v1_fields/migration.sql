ALTER TABLE "SideTaskItem"
  ADD COLUMN IF NOT EXISTS "eventArchetype" TEXT,
  ADD COLUMN IF NOT EXISTS "eventChain" TEXT,
  ADD COLUMN IF NOT EXISTS "languageVariant" TEXT,
  ADD COLUMN IF NOT EXISTS "narrativeComponents" TEXT;
