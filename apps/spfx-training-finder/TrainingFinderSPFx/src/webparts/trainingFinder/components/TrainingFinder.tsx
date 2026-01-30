import * as React from 'react';
import styles from './TrainingFinder.module.scss';
import type { ITrainingFinderProps } from './ITrainingFinderProps';
import type { RankedTraining, TrainingRecord } from '../lib/schema';
import { fetchAllListItems } from '../lib/sharepoint';
import { buildLexicalIndex, applyStructuredFilters, rankLexical, type LexicalIndex } from '../lib/search';

type Msg = { role: "user" | "bot"; text: string };

type Intent = {
  query: string;
  modality?: string;
  language?: string;
  platform?: string;
  audienceContains?: string;
};

function extractIntentDelta(text: string): Partial<Intent> {
  const t = text.toLowerCase();
  const delta: Partial<Intent> = {};

  // Modality
  if (/\bonline\b/.test(t)) delta.modality = "online";
  if (/\bin[- ]person\b/.test(t)) delta.modality = "in_person";
  if (/\bblended\b/.test(t)) delta.modality = "blended";

  // Language (common in the dataset)
  const langMap: Array<[RegExp, string]> = [
    [/\benglish\b/, "English"],
    [/\bfrench\b/, "French"],
    [/\bspanish\b/, "Spanish"],
    [/\brussian\b/, "Russian"],
    [/\barabic\b/, "Arabic"],
    [/\bportuguese\b/, "Portuguese"],
    [/\bpolish\b/, "Polish"],
    [/\bukrainian\b/, "Ukrainian"],
    [/\bchinese\b/, "Chinese"],
    [/\bkirundi\b/, "Kirundi"]
  ];
  for (const [re, val] of langMap) {
    if (re.test(t)) {
      delta.language = val;
      break;
    }
  }

  // Platform (match by substring; not an enum)
  const platformHints: Array<[RegExp, string]> = [
    [/\bopenwho\b/, "OpenWHO"],
    [/\bwho academy\b/, "WHO Academy"],
    [/\bhslp\b/, "HSLP"],
    [/\bgoarn\b/, "GOARN"],
    [/\bvirtual campus\b/, "Virtual campus"]
  ];
  for (const [re, val] of platformHints) {
    if (re.test(t)) {
      delta.platform = val;
      break;
    }
  }

  // Audience heuristics
  if (/\bmember state(s)?\b/.test(t) || /\bministry of health\b/.test(t) || /\bmoh\b/.test(t)) {
    delta.audienceContains = "Member";
  }
  if (/\bwho staff\b/.test(t)) delta.audienceContains = "WHO";

  return delta;
}

function mergeIntent(prev: Intent, userText: string): Intent {
  const delta = extractIntentDelta(userText);
  const query = userText.trim();
  return {
    ...prev,
    ...delta,
    query: query || prev.query
  };
}

interface ITrainingFinderState {
  records: TrainingRecord[] | null;
  index: LexicalIndex | null;
  loading: boolean;
  messages: Msg[];
  input: string;
  intent: Intent;
  lastResults: RankedTraining[] | null;
}

export default class TrainingFinder extends React.Component<ITrainingFinderProps, ITrainingFinderState> {
  private messagesEndRef = React.createRef<HTMLDivElement>();

  constructor(props: ITrainingFinderProps) {
    super(props);
    this.state = {
      records: null,
      index: null,
      loading: false,
      messages: [
        {
          role: "bot",
          text:
            "Tell me what training you need (topic, what you want to achieve). You can also mention language, modality (online / in-person / blended), platform (OpenWHO / WHO Academy / HSLP), or audience."
        }
      ],
      input: "",
      intent: { query: "" },
      lastResults: null
    };
  }

  public componentDidMount(): void {
    this.loadData().catch((e) => {
      console.error("Failed to load training data:", e);
    });
  }

  public componentDidUpdate(_prevProps: ITrainingFinderProps, prevState: ITrainingFinderState): void {
    if (this.state.messages.length !== prevState.messages.length || this.state.lastResults !== prevState.lastResults) {
      this.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  private async loadData(): Promise<void> {
    this.setState({ loading: true });
    try {
      const fresh = await fetchAllListItems(
        this.props.spHttpClient,
        this.props.siteAbsoluteUrl,
        {
          siteRelativeUrl: "",
          listTitle: this.props.listTitle
        }
      );
      this.setState({
        records: fresh,
        index: buildLexicalIndex(fresh),
        loading: false
      });
    } catch (e) {
      this.setState({
        loading: false,
        messages: [
          ...this.state.messages,
          { role: "bot", text: `Could not load SharePoint list items.\n${String(e)}` }
        ]
      });
    }
  }

  private async runSearch(userText: string): Promise<void> {
    const { records, index, intent, messages } = this.state;
    if (!records || !index) return;

    const nextIntent = mergeIntent(intent, userText);
    this.setState({ intent: nextIntent });

    const minUsefulQueryLen = 4;
    const hasSomeConstraint =
      Boolean(nextIntent.modality) ||
      Boolean(nextIntent.language) ||
      Boolean(nextIntent.platform) ||
      Boolean(nextIntent.audienceContains);

    if (!hasSomeConstraint && nextIntent.query.trim().length < minUsefulQueryLen) {
      this.setState({
        messages: [
          ...messages,
          {
            role: "bot",
            text:
              "I can help, but I need a bit more detail. What topic or objective are you targeting (for example: IHR, RCCE, surveillance, laboratory, incident management)?"
          }
        ]
      });
      return;
    }

    const filtered = applyStructuredFilters(records, {
      modality: nextIntent.modality,
      language: nextIntent.language,
      platform: nextIntent.platform,
      audienceContains: nextIntent.audienceContains
    });

    const ranked = rankLexical(filtered, nextIntent.query, index);
    const top = ranked.slice(0, 12);
    
    const summaryParts: string[] = [];
    if (nextIntent.language) summaryParts.push(`language: ${nextIntent.language}`);
    if (nextIntent.modality) summaryParts.push(`modality: ${nextIntent.modality}`);
    if (nextIntent.platform) summaryParts.push(`platform: ${nextIntent.platform}`);
    if (nextIntent.audienceContains) summaryParts.push(`audience contains: ${nextIntent.audienceContains}`);

    this.setState({
      lastResults: top,
      messages: [
        ...messages,
        {
          role: "bot",
          text:
            `I found ${ranked.length} match(es)` +
            (summaryParts.length ? ` (${summaryParts.join(", ")}).` : ".") +
            ` Showing top ${top.length}.`
        }
      ]
    });
  }

  private async onSend(): Promise<void> {
    const text = this.state.input.trim();
    if (!text) return;
    
    const { records, index, messages } = this.state;
    this.setState({ input: "", messages: [...messages, { role: "user", text }] });
    
    if (!records || !index) {
      this.setState({
        messages: [...this.state.messages, { role: "bot", text: "Loading training data—try again in a few seconds." }]
      });
      return;
    }
    await this.runSearch(text);
  }

  private handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ input: e.target.value });
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      void this.onSend();
    }
  };

  public render(): React.ReactElement<ITrainingFinderProps> {
    const { isDarkTheme, hasTeamsContext } = this.props;
    const { loading, messages, input, lastResults } = this.state;

    return (
      <section className={`${styles.trainingFinder} ${hasTeamsContext ? styles.teams : ''} ${isDarkTheme ? styles.dark : ''}`}>
        <div className={styles.header}>
          <div className={styles.title}>WHO Training Finder</div>
          <div className={styles.subtitle}>
            Search WHO trainings by topic, language, modality, or platform.
          </div>
          <button
            className={styles.refreshButton}
            disabled={loading}
            onClick={() => this.loadData()}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className={styles.chatContainer}>
          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.message} ${m.role === "user" ? styles.userMessage : styles.botMessage}`}>
                {m.text}
              </div>
            ))}
            <div ref={this.messagesEndRef} />
          </div>
          <div className={styles.composer}>
            <input
              type="text"
              value={input}
              placeholder="Describe what you need…"
              onChange={this.handleInputChange}
              onKeyDown={this.handleKeyDown}
              className={styles.input}
            />
            <button className={styles.sendButton} onClick={() => void this.onSend()}>
              Send
            </button>
          </div>
        </div>

        {lastResults && lastResults.length > 0 && (
          <div className={styles.results}>
            <div className={styles.resultsTitle}>Top Results</div>
            {lastResults.map((r, i) => (
              <div key={i} className={styles.card}>
                <div className={styles.cardTitle}>{r.record.learningName}</div>
                <div className={styles.cardDescription}>{r.record.description}</div>
                <div className={styles.pillRow}>
                  {r.record.technicalArea && <span className={styles.pill}>{r.record.technicalArea}</span>}
                  {r.record.focusArea && <span className={styles.pill}>{r.record.focusArea}</span>}
                  {r.record.modality && r.record.modality !== "unknown" && <span className={styles.pill}>{r.record.modality}</span>}
                  {r.record.platform && <span className={styles.pill}>{r.record.platform}</span>}
                  {r.record.languages.length > 0 && <span className={styles.pill}>{r.record.languages.join(", ")}</span>}
                </div>
                {r.record.normalizedLink && (
                  <div className={styles.link}>
                    <a href={r.record.normalizedLink} target="_blank" rel="noreferrer">
                      Open training
                    </a>
                  </div>
                )}
                {r.reasons.length > 0 && <div className={styles.reasons}>Why: {r.reasons.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }
}
