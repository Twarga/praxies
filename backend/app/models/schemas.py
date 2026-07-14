from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.settings import APP_VERSION


LanguageCode = Literal["en", "fr", "es"]
VideoQuality = Literal["480p", "720p", "1080p"]
Directness = Literal["gentle", "direct", "brutal"]
LlmProvider = str
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


# ── v2 configuration models ────────────────────────────────────────────────

class ProviderConnectionModel(StrictModel):
    """Connection to an AI provider. Stores a secret reference, never a plaintext key."""
    provider_id: str
    display_name: str = ""
    auth_profile_id: str = ""
    selected_model_id: str = ""
    base_url: str = ""
    catalog_updated_at: str | None = None
    enabled: bool = True


class ConfigTranscriptionV2Model(StrictModel):
    """Transcription engine and model configuration."""
    engine_id: str = "faster_whisper"
    model_id: str = "large-v3-turbo"
    cache_folder: str
    device: str = "cpu"
    compute_type: str = "int8"


class ConfigModelV2(StrictModel):
    """Configuration schema v2 — no plaintext secrets in the config file."""
    schema_version: int = 2
    app_version: str = APP_VERSION
    journal_folder: str
    language_default: LanguageCode = "en"
    video_quality: VideoQuality = "720p"
    retention_days: int = Field(default=30, ge=0)
    active_provider_connection_id: str | None = None
    provider_connections: dict[str, ProviderConnectionModel] = Field(default_factory=dict)
    transcription: ConfigTranscriptionV2Model
    directness: Directness = "direct"
    personal_context: str = ""
    phone_upload_enabled: bool = False
    ready_sound_enabled: bool = True
    setup_completed: bool = False
    theme: str = "graphite-studio"
    telegram: ConfigTelegramModel = Field(default_factory=lambda: ConfigTelegramModel(
        enabled=False, bot_token="", chat_id="", daily_digest_time="08:00", weekly_rollup_time="sunday 20:00",
    ))


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


# ── v3 analysis models ─────────────────────────────────────────────────────

class PreviousGoalResultV3Model(StrictModel):
    goal_id: str | None = None
    result: Literal["not_applicable", "followed", "partially_followed", "missed", "uncertain"] = "not_applicable"
    summary: str = ""
    evidence: list[dict[str, object]] = Field(default_factory=list)


class ReportStrengthV3Model(StrictModel):
    title: str = ""
    explanation: str = ""
    evidence: dict[str, object] | None = None


class ReportImprovementV3Model(StrictModel):
    title: str = ""
    explanation: str = ""
    replacement_behavior: str = ""


class ReportEvidenceMomentV3Model(StrictModel):
    timestamp_seconds: float = Field(default=0, ge=0)
    quote: str = ""
    explanation: str = ""


class ReportPracticeV3Model(StrictModel):
    title: str = ""
    instructions: str = ""
    success_criteria: list[str] = Field(default_factory=list)


class ReportNextGoalV3Model(StrictModel):
    goal_id: str = ""
    text: str = ""
    success_criteria: list[str] = Field(default_factory=list)


class AnalysisReportV3Model(StrictModel):
    verdict: str = ""
    previous_goal: PreviousGoalResultV3Model = Field(default_factory=PreviousGoalResultV3Model)
    strength: ReportStrengthV3Model = Field(default_factory=ReportStrengthV3Model)
    priority_improvement: ReportImprovementV3Model = Field(default_factory=ReportImprovementV3Model)
    evidence_moments: list[ReportEvidenceMomentV3Model] = Field(default_factory=list)
    practice: ReportPracticeV3Model = Field(default_factory=ReportPracticeV3Model)
    next_goal: ReportNextGoalV3Model = Field(default_factory=ReportNextGoalV3Model)


class AnalysisModelV3(StrictModel):
    schema_version: int = 3
    language: Literal["en", "fr", "es"]
    report: AnalysisReportV3Model = Field(default_factory=AnalysisReportV3Model)
    details: dict[str, object] = Field(default_factory=dict)


# ── goals and practice repositories ─────────────────────────────────────────

class GoalModel(StrictModel):
    """A measurable goal that bridges one session to the next."""
    goal_id: str
    source_session_id: str
    text: str
    category: str = "journal"
    success_criteria: list[str] = Field(default_factory=list)
    status: Literal["active", "completed", "abandoned"] = "active"
    created_at: str
    completed_at: str | None = None
    abandoned_at: str | None = None


class PracticeAssignmentModel(StrictModel):
    """One exercise generated from a coaching report."""
    assignment_id: str
    source_session_id: str
    source_goal_id: str | None = None
    title: str = ""
    instructions: str = ""
    success_criteria: list[str] = Field(default_factory=list)
    completed: bool = False
    completed_at: str | None = None
    created_at: str


class CoachProfileModel(StrictModel):
    """Editable coaching profile stored in _coach/profile.json."""
    objective: str = ""
    language_focus: list[LanguageCode] = Field(default_factory=list)
    updated_at: str


class GoalRepositoryModel(StrictModel):
    """_coach/goals.json — goal history."""
    goals: list[GoalModel] = Field(default_factory=list)
    active_goal_id: str | None = None
    active_goal_ids: list[str] = Field(default_factory=list)


class PracticeRepositoryModel(StrictModel):
    """_practice/assignments.json — exercise history."""
    assignments: list[PracticeAssignmentModel] = Field(default_factory=list)


# ── provider and transcription contracts ───────────────────────────────────

class ProviderModelInfo(StrictModel):
    """Normalized model from a provider's live catalog."""
    id: str
    display_name: str = ""
    provider_id: str
    context_window: int | None = None
    input_modalities: list[str] = Field(default_factory=lambda: ["text"])
    output_modalities: list[str] = Field(default_factory=lambda: ["text"])
    supports_structured_output: Literal["unknown", "verified", "failed"] = "unknown"
    availability: Literal["available", "deprecated", "unavailable"] = "available"
    pricing: dict[str, object] | None = None
    source: Literal["provider_authenticated_catalog", "provider_public_catalog", "supplemental_metadata", "cached"] = "provider_authenticated_catalog"
    fetched_at: str


class ProviderAuthMethod(StrictModel):
    type: Literal["api_key", "bearer_token", "oauth", "device_code", "subscription_token"]
    label: str = ""
    required: bool = True


class ProviderCapabilities(StrictModel):
    supports_streaming: bool = False
    supports_structured_output: bool = False
    supports_usage_endpoint: bool = False
    supports_catalog_endpoint: bool = False


class ProviderAdapterInfo(StrictModel):
    """Registry metadata for a provider adapter."""
    provider_id: str
    display_name: str
    auth_methods: list[ProviderAuthMethod] = Field(default_factory=list)
    capabilities: ProviderCapabilities = Field(default_factory=ProviderCapabilities)
    requires_base_url: bool = False
    available: bool = True


class ModelTestResult(StrictModel):
    """Result of a Praxis compatibility test against a selected model."""
    model_id: str
    provider_id: str
    tested_at: str
    authentication_ok: bool = False
    routing_ok: bool = False
    json_valid: bool = False
    required_fields_present: bool = False
    latency_ms: int | None = None
    error_code: str | None = None
    error_detail: str | None = None


class CreateProviderConnectionRequest(StrictModel):
    """Request body for creating a provider connection."""
    provider_id: str
    api_key: str = ""
    base_url: str = ""
    display_name: str = ""


class UpdateProviderConnectionRequest(StrictModel):
    """Request body for updating a provider connection."""
    selected_model_id: str | None = None
    display_name: str | None = None
    active: bool | None = None


class TestProviderModelRequest(StrictModel):
    """Request body for testing a provider model."""
    model_id: str


class TranscriptionModelInfo(StrictModel):
    """Model available from a transcription engine."""
    model_id: str
    engine_id: str
    display_name: str = ""
    languages: list[str] = Field(default_factory=list)
    estimated_disk_gb: float = 0
    estimated_ram_gb: float = 0
    supported_compute_types: list[str] = Field(default_factory=list)
    source_revision: str = ""
    license_label: str = ""
    compatible: bool = True
    incompatibility_reason: str = ""


class TranscriptionEngineInfo(StrictModel):
    """Registry metadata for a transcription engine."""
    engine_id: str
    display_name: str
    available: bool = False
    runtime_version: str = ""
    supported: bool = False
    recommended: bool = False


class HardwareInfo(StrictModel):
    cpu_architecture: str = ""
    logical_cores: int = 0
    total_ram_gb: float = 0
    gpu_vendor: str = ""
    gpu_name: str = ""
    cuda_available: bool = False
    vulkan_available: bool = False
    free_disk_gb: float = 0


class TranscriptionBenchmarkResult(StrictModel):
    model_id: str
    engine_id: str
    audio_duration_seconds: float = 0
    processing_seconds: float = 0
    real_time_factor: float = 0
    detected_language: str | None = None
    device: str = "cpu"
    compute_type: str = "int8"
    transcript_text: str = ""
    reference_text: str = ""
    word_error_rate: float | None = None
    timestamp: str


class SecretRecord(StrictModel):
    """Metadata about a stored secret. The value lives in Linux Secret Service."""
    secret_id: str
    provider_id: str
    account_label: str = ""
    auth_type: str = ""
    import_source: str = ""
    created_at: str


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
