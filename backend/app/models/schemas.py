from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.settings import APP_VERSION


LanguageCode = Literal["en", "fr", "es"]
VideoQuality = Literal["480p", "720p", "1080p"]
Directness = Literal["gentle", "direct", "brutal"]
LlmProvider = Literal["openrouter", "opencode_go", "openai_compatible", "litellm_proxy"]
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
SessionSource = Literal["screen", "upload", "webcam"]
PracticeGoalResult = Literal["unmarked", "followed", "partially_followed", "missed"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConfigOpenRouterModel(StrictModel):
    api_key: str
    default_model: str


class ConfigLlmModel(StrictModel):
    provider: LlmProvider = "openrouter"
    api_key: str = ""
    model: str = "google/gemini-2.5-flash-lite"
    base_url: str = ""
    provider_api_keys: dict[str, str] = Field(default_factory=dict)
    provider_models: dict[str, str] = Field(default_factory=dict)
    provider_base_urls: dict[str, str] = Field(default_factory=dict)


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
    app_version: str = APP_VERSION
    journal_folder: str
    language_default: LanguageCode
    video_quality: VideoQuality
    retention_days: int = Field(ge=0)
    openrouter: ConfigOpenRouterModel
    llm: ConfigLlmModel = Field(default_factory=ConfigLlmModel)
    whisper: ConfigWhisperModel
    directness: Directness
    personal_context: str
    phone_upload_enabled: bool
    ready_sound_enabled: bool
    setup_completed: bool = False
    theme: str
    telegram: ConfigTelegramModel


class MetaProcessingTerminalLineModel(StrictModel):
    created_at: str
    level: Literal["info", "success", "warning", "error"] = "info"
    message: str


class MetaProcessingModel(StrictModel):
    transcribe_started_at: str | None = None
    transcribe_finished_at: str | None = None
    analyze_started_at: str | None = None
    analyze_finished_at: str | None = None
    model_used: str | None = None
    progress_label: str | None = None
    progress_percent: int = Field(default=0, ge=0, le=100)
    terminal_lines: list[MetaProcessingTerminalLineModel] = Field(default_factory=list)
    attempts: int = Field(default=0, ge=0)


class MetaRetentionModel(StrictModel):
    video_kept_until: str | None = None
    compressed: bool = False


class MetaPracticeModel(StrictModel):
    assignment_completed: bool = False
    assignment_completed_at: str | None = None
    previous_goal: str = ""
    previous_goal_source_session_id: str | None = None
    previous_goal_result: PracticeGoalResult = "unmarked"
    previous_goal_note: str = ""


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
    practice: MetaPracticeModel = Field(default_factory=MetaPracticeModel)


class IndexSessionSummary(StrictModel):
    id: str
    created_at: str
    language: LanguageCode
    title: str
    duration_seconds: float = Field(ge=0)
    status: SessionStatus
    save_mode: SessionSaveMode = "full"
    error: str | None = None
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


class AnalysisScorecardMetricModel(StrictModel):
    score: int = Field(default=0, ge=0, le=10)
    evidence: str = ""
    practice_focus: str = ""


class AnalysisScorecardModel(StrictModel):
    clarity: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)
    structure: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)
    reflection_depth: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)
    emotional_awareness: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)
    specificity: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)
    actionability: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)
    language_fluency: AnalysisScorecardMetricModel = Field(default_factory=AnalysisScorecardMetricModel)


class AnalysisMomentFeedbackModel(StrictModel):
    timestamp_seconds: float = Field(default=0, ge=0)
    label: str = ""
    transcript_quote: str = ""
    coaching_note: str = ""
    kind: Literal["strength", "insight", "breakdown", "practice_cue"] = "practice_cue"

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, value: object) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"strength", "insight", "breakdown", "practice_cue"}:
            return normalized
        if "strength" in normalized or "good" in normalized:
            return "strength"
        if "insight" in normalized or "note" in normalized or "observation" in normalized:
            return "insight"
        if "break" in normalized or "weak" in normalized or "problem" in normalized:
            return "breakdown"
        return "practice_cue"


class AnalysisLessonModel(StrictModel):
    title: str = ""
    what_happened: str = ""
    why_it_matters: str = ""
    next_move: str = ""


class AnalysisBehaviorPatternObservationModel(StrictModel):
    name: str = ""
    evidence: str = ""
    impact: str = ""
    correction: str = ""


class AnalysisPracticeAssignmentModel(StrictModel):
    reflection_question: str = ""
    speaking_drill: str = ""
    behavioral_action: str = ""
    next_session_goal: str = ""


class AnalysisLanguageRewriteDrillModel(StrictModel):
    timestamp_seconds: float = Field(default=0, ge=0)
    original: str = ""
    improved: str = ""
    explanation: str = ""


class AnalysisLanguageCoachModel(StrictModel):
    strongest_sentence: str = ""
    main_language_gap: str = ""
    rewrite_drills: list[AnalysisLanguageRewriteDrillModel] = Field(default_factory=list)


class AnalysisCoachingReportModel(StrictModel):
    headline: str = ""
    opening_read: str = ""
    what_improved: str = ""
    what_held_back: str = ""
    best_moment: AnalysisMomentFeedbackModel = Field(default_factory=AnalysisMomentFeedbackModel)
    top_lessons: list[AnalysisLessonModel] = Field(default_factory=list)
    moment_feedback: list[AnalysisMomentFeedbackModel] = Field(default_factory=list)
    behavioral_patterns: list[AnalysisBehaviorPatternObservationModel] = Field(default_factory=list)
    practice_assignment: AnalysisPracticeAssignmentModel = Field(default_factory=AnalysisPracticeAssignmentModel)


class AnalysisModel(StrictModel):
    schema_version: int = 2
    language: Literal["en", "fr", "es"]
    prose_verdict: str
    session_summary: str
    main_topics: list[str]
    coaching_report: AnalysisCoachingReportModel = Field(default_factory=AnalysisCoachingReportModel)
    scorecard: AnalysisScorecardModel = Field(default_factory=AnalysisScorecardModel)
    language_coach: AnalysisLanguageCoachModel = Field(default_factory=AnalysisLanguageCoachModel)
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
    confirmed: bool = False


class RecurringPatternsModel(StrictModel):
    language: Literal["en", "fr", "es"]
    updated_at: str
    patterns: list[RecurringPatternEntry]


class PatternCalibrationRequestModel(StrictModel):
    action: Literal["confirm", "rename", "merge", "dismiss"]
    pattern_name: str
    target_name: str = ""
    target_description: str = ""


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
