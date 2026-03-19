-- Initial schema for Ireland Data Analytics Job Radar

CREATE TYPE "SourceName" AS ENUM ('LINKEDIN', 'JOBSIRELAND', 'GLASSDOOR', 'IRISHJOBS', 'INDEED', 'MOCK');
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'GRADUATE', 'UNKNOWN');
CREATE TYPE "SeniorityLevel" AS ENUM ('ENTRY', 'JUNIOR', 'ASSOCIATE', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'UNKNOWN');
CREATE TYPE "MatchLevel" AS ENUM ('APPLY_NOW', 'STRONG_MATCH', 'GOOD_MATCH', 'STRETCH', 'LOW_MATCH', 'EXCLUDE');
CREATE TYPE "Classification" AS ENUM ('RELEVANT', 'ADJACENT', 'EXCLUDED');
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'REVIEWING', 'SAVED', 'APPLIED', 'INTERVIEW', 'REJECTED', 'CLOSED', 'DISMISSED', 'SNOOZED');
CREATE TYPE "ScanStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL_FAILURE', 'FAILED');
CREATE TYPE "ProviderHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'DISABLED');

CREATE TABLE "Source" (
  "id" TEXT PRIMARY KEY,
  "name" "SourceName" NOT NULL UNIQUE,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "health" "ProviderHealth" NOT NULL DEFAULT 'HEALTHY',
  "mockMode" BOOLEAN NOT NULL DEFAULT false,
  "baseUrl" TEXT,
  "lastSuccessfulScan" TIMESTAMP(3),
  "lastScanAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Company" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL UNIQUE,
  "website" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Job" (
  "id" TEXT PRIMARY KEY,
  "canonicalKey" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "titleNormalized" TEXT NOT NULL,
  "companyId" TEXT,
  "companyNameCached" TEXT NOT NULL,
  "locationText" TEXT,
  "city" TEXT,
  "county" TEXT,
  "country" TEXT,
  "workMode" "WorkMode" NOT NULL DEFAULT 'UNKNOWN',
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'UNKNOWN',
  "seniorityLevel" "SeniorityLevel" NOT NULL DEFAULT 'UNKNOWN',
  "salaryMin" INTEGER,
  "salaryMax" INTEGER,
  "salaryCurrency" TEXT,
  "descriptionRaw" TEXT,
  "descriptionClean" TEXT,
  "postedAt" TIMESTAMP(3),
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "sourcePrimary" "SourceName" NOT NULL,
  "applyUrl" TEXT,
  "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "urgencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "titleMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "skillsMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "seniorityFitScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "eligibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "matchLevel" "MatchLevel" NOT NULL DEFAULT 'LOW_MATCH',
  "classification" "Classification" NOT NULL DEFAULT 'RELEVANT',
  "sponsorshipMentioned" BOOLEAN NOT NULL DEFAULT false,
  "workAuthorizationMentioned" BOOLEAN NOT NULL DEFAULT false,
  "extractedSkillsJson" JSONB,
  "matchedKeywordsJson" JSONB,
  "excludedKeywordsJson" JSONB,
  "scoringReasonsJson" JSONB,
  "classificationReason" TEXT,
  "scanConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duplicateGroupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "JobSource" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceName" "SourceName" NOT NULL,
  "sourceJobId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "applyUrl" TEXT,
  "sourcePostedText" TEXT,
  "sourcePostedAt" TIMESTAMP(3),
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawPayloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "JobSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "JobSource_sourceId_sourceJobId_key" UNIQUE ("sourceId", "sourceJobId")
);

CREATE TABLE "JobSkillTag" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "skill" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobSkillTag_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UserJobState" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL UNIQUE,
  "status" "JobStatus" NOT NULL DEFAULT 'NEW',
  "isSaved" BOOLEAN NOT NULL DEFAULT false,
  "isDismissed" BOOLEAN NOT NULL DEFAULT false,
  "isApplied" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "followUpAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserJobState_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ScanRun" (
  "id" TEXT PRIMARY KEY,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" "ScanStatus" NOT NULL DEFAULT 'RUNNING',
  "totalFetched" INTEGER NOT NULL DEFAULT 0,
  "totalCreated" INTEGER NOT NULL DEFAULT 0,
  "totalUpdated" INTEGER NOT NULL DEFAULT 0,
  "totalDuplicates" INTEGER NOT NULL DEFAULT 0,
  "totalFailedSources" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ScanRunSourceResult" (
  "id" TEXT PRIMARY KEY,
  "scanRunId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "status" "ScanStatus" NOT NULL,
  "durationMs" INTEGER,
  "fetchedCount" INTEGER NOT NULL DEFAULT 0,
  "parsedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "detailsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScanRunSourceResult_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "ScanRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScanRunSourceResult_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SearchConfig" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "includedSources" JSONB NOT NULL,
  "keywordGroups" JSONB NOT NULL,
  "excludedKeywordGroups" JSONB NOT NULL,
  "locationFilters" JSONB NOT NULL,
  "minimumScore" DOUBLE PRECISION NOT NULL DEFAULT 35,
  "applyNowThreshold" DOUBLE PRECISION NOT NULL DEFAULT 80,
  "includeStretchRoles" BOOLEAN NOT NULL DEFAULT true,
  "includeContractJobs" BOOLEAN NOT NULL DEFAULT true,
  "includeGraduateRoles" BOOLEAN NOT NULL DEFAULT true,
  "includeRemoteIreland" BOOLEAN NOT NULL DEFAULT true,
  "includeSuspiciousMatches" BOOLEAN NOT NULL DEFAULT false,
  "refreshFrequencyMinutes" INTEGER NOT NULL DEFAULT 180,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "KeywordGroup" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "groupType" TEXT NOT NULL,
  "keywords" JSONB NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Job_postedAt_idx" ON "Job" ("postedAt");
CREATE INDEX "Job_discoveredAt_idx" ON "Job" ("discoveredAt");
CREATE INDEX "Job_finalScore_idx" ON "Job" ("finalScore");
CREATE INDEX "Job_matchLevel_idx" ON "Job" ("matchLevel");
CREATE INDEX "Job_country_county_city_idx" ON "Job" ("country", "county", "city");
CREATE INDEX "Job_duplicateGroupId_idx" ON "Job" ("duplicateGroupId");
CREATE INDEX "Job_titleNormalized_idx" ON "Job" ("titleNormalized");
CREATE INDEX "JobSource_jobId_idx" ON "JobSource" ("jobId");
CREATE INDEX "JobSource_sourceName_idx" ON "JobSource" ("sourceName");
CREATE INDEX "JobSkillTag_jobId_idx" ON "JobSkillTag" ("jobId");
CREATE INDEX "JobSkillTag_skill_idx" ON "JobSkillTag" ("skill");
CREATE INDEX "Source_health_idx" ON "Source" ("health");
CREATE INDEX "ScanRun_startedAt_idx" ON "ScanRun" ("startedAt");
CREATE INDEX "ScanRun_status_idx" ON "ScanRun" ("status");
CREATE INDEX "ScanRunSourceResult_scanRunId_idx" ON "ScanRunSourceResult" ("scanRunId");
CREATE INDEX "ScanRunSourceResult_sourceId_idx" ON "ScanRunSourceResult" ("sourceId");
CREATE INDEX "ScanRunSourceResult_status_idx" ON "ScanRunSourceResult" ("status");
CREATE INDEX "KeywordGroup_groupType_idx" ON "KeywordGroup" ("groupType");
CREATE INDEX "KeywordGroup_isActive_idx" ON "KeywordGroup" ("isActive");
