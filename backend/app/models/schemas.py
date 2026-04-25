from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


LanguageCode = Literal["en", "fr", "es"]
VideoQuality = Literal["480p", "720p", "1080p"]
Directness = Literal["gentle", "direct", "brutal"]
WhisperModelName = Literal["tiny", "base", "small", "medium", "large-v3", "large-v3-turbo"]
SessionStatus = Literal[
    "recording",
    "saved",
    "queued",
    "transcribing",
    "analyzing",
    "done",
    "ready",
    "failed",
    "needs_attention",
    "video_only",
]
SessionSaveMode = Literal["full", "transcribe_only", "video_only"]
SessionTitleSource = Literal["user", "llm", "default"]
SessionSource = Literal["webcam", "upload"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConfigOpenRouterModel(StrictModel):
    api_key: str
    default_model: str


class ConfigWhisperModel(StrictModel):
    model: WhisperModelName
    compute_type: str
    device: str


class ConfigTelegramModel(StrictModel):
    enabled: bool
    bot_token: str
    chat_id: str
    daily_digest_time: str
    weekly_rollup_time: str


class ConfigModel(StrictModel):
    schema_version: int = 1
    journal_folder: str
    language_default: LanguageCode
    video_quality: VideoQuality
    retention_days: int = Field(ge=0)
    openrouter: ConfigOpenRouterModel
    whisper: ConfigWhisperModel
    directness: Directness
    personal_context: str
    phone_upload_enabled: bool
    ready_sound_enabled: bool
    theme: str
    telegram: ConfigTelegramModel


class MetaProcessingModel(StrictModel):
    transcribe_started_at: str | None = None
    transcribe_finished_at: str | None = None
    analyze_started_at: str | None = None
    analyze_finished_at: str | None = None
    model_used: str | None = None
    attempts: int = Field(default=0, ge=0)


class MetaRetentionModel(StrictModel):
    video_kept_until: str | None = None
    compressed: bool = False


class MetaModel(StrictModel):
    id: str
    created_at: str
    language: LanguageCode
    title: str
    title_source: SessionTitleSource
    duration_seconds: float = Field(ge=0)
    file_size_bytes: int = Field(ge=0)
    status: SessionStatus
    save_mode: SessionSaveMode
    source: SessionSource
    video_filename: str | None = None
    error: str | None = None
    read: bool
    processing: MetaProcessingModel
    retention: MetaRetentionModel


class IndexSessionSummary(StrictModel):
    id: str
    created_at: str
    language: LanguageCode
    title: str
    duration_seconds: float = Field(ge=0)
    status: SessionStatus
    read: bool


class IndexStreakModel(StrictModel):
    current: int = Field(ge=0)
    longest: int = Field(ge=0)
    last_active_date: str | None = None
    last_reset_date: str | None = None


class IndexTotalsModel(StrictModel):
    sessions: int = Field(ge=0)
    total_seconds: float = Field(ge=0)
    by_language: dict[LanguageCode, int]


class IndexModel(StrictModel):
    generated_at: str
    sessions: list[IndexSessionSummary]
    streak: IndexStreakModel
    totals: IndexTotalsModel


class AnalysisGrammarError(StrictModel):
    said: str
    correct: str
    type: str
    timestamp_seconds: float = Field(ge=0)


class AnalysisGrammarAndLanguageModel(StrictModel):
    errors: list[AnalysisGrammarError]
    fluency_score: int = Field(ge=0, le=10)
    vocabulary_level: str
    filler_words: dict[str, int]


class AnalysisSpeakingQualityModel(StrictModel):
    clarity: int = Field(ge=0, le=10)
    pace: str
    structure: str
    executive_presence_notes: str


class AnalysisIdeasAndReasoningModel(StrictModel):
    strong_points: list[str]
    weak_points: list[str]
    logical_flaws: list[str]
    factual_errors: list[str]
    philosophical_pushback: str


class AnalysisModel(StrictModel):
    schema_version: int = 1
    language: Literal["en", "fr", "es"]
    prose_verdict: str
    session_summary: str
    main_topics: list[str]
    grammar_and_language: AnalysisGrammarAndLanguageModel
    speaking_quality: AnalysisSpeakingQualityModel
    ideas_and_reasoning: AnalysisIdeasAndReasoningModel
    recurring_patterns_hit: list[str]
    actionable_improvements: list[str]


class RecurringPatternEntry(StrictModel):
    name: str
    description: str
    count: int = Field(ge=0)
    first_seen: str
    last_seen: str
    recent_sessions: list[str]


class RecurringPatternsModel(StrictModel):
    language: Literal["en", "fr", "es"]
    updated_at: str
    patterns: list[RecurringPatternEntry]


class WeeklyRollupModel(StrictModel):
    week: str
    generated_at: str
    session_count: int = Field(ge=0)
    total_seconds: float = Field(ge=0)
    languages_used: list[LanguageCode]
    summary_prose: str
    improvements: list[str]
    still_breaking: list[str]
    focus_for_next_week: str
