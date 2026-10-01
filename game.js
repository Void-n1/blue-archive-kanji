/**
 * ブルアカ漢字クイズ - ゲームエンジン
 */

// =============================================================================
// 🏆 リザルト・ランク判定の設定（必要に応じて自由に編集・調整できます）
// =============================================================================
// 条件の変更や秒数（2.5秒、5.0秒など）の調整はここを編集してください。
const RANK_SETTINGS = {
  // プラチナ: パーフェクト（ミス0） かつ 平均回答速度が2.5秒以下
  PLATINUM: {
    label: "RANK: プラチナ",
    badgeClass: "rank-platinum",
    description: "全問正解 & 神速回答！",
    // 判定条件 (total:総問題数, correct:正解数, avgTime:平均秒数)
    isMatch: (total, correct, avgTime) => (correct === total && total > 0 && avgTime <= 2.5)
  },

  // ゴールド: パーフェクト（ミス0）
  GOLD: {
    label: "RANK: ゴールド",
    badgeClass: "rank-gold",
    description: "全問正解パーフェクト！",
    // 判定条件
    isMatch: (total, correct, avgTime) => (correct === total && total > 0 && avgTime <= 3.5)
  },

  // シルバー: 1問以上ミスあり かつ 平均回答速度が5.0秒以下
  SILVER: {
    label: "RANK: シルバー",
    badgeClass: "rank-silver",
    description: "高速クリア！",
    // 判定条件 (1問以上ミス かつ 平均5秒以下)
    isMatch: (total, correct, avgTime) => (correct < total && avgTime <= 5.0)
  },

  // ブロンズ: 上記以外（ミスあり、かつ平均回答速度が5.0秒超など）
  BRONZE: {
    label: "RANK: ブロンズ",
    badgeClass: "rank-bronze",
    description: "クリア！",
    // 判定条件 (フォールバック)
    isMatch: () => true
  }
};

/**
 * リザルトのランク判定関数
 * 判定優先度順（PLATINUM → GOLD → SILVER → BRONZE）に条件をチェックして返します。
 */
function evaluateGameRank(total, correct, avgTime) {
  const rankOrder = ["PLATINUM", "GOLD", "SILVER", "BRONZE"];
  for (const key of rankOrder) {
    const config = RANK_SETTINGS[key];
    if (config && config.isMatch(total, correct, avgTime)) {
      return config;
    }
  }
  return RANK_SETTINGS.BRONZE;
}

class KanjiGoGame {
  constructor() {
    this.questions = [];
    this.selectedCategory = "ALL";
    this.selectedCount = 10;
    this.currentQuestions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correctCount = 0;
    this.history = []; // 振り返り用

    this.timer = null;
    this.timeLimitMs = 12000; // 1問12秒 (ヒントや出典も読めるように少し余裕を確保)
    this.remainingMs = 0;
    this.isAnswering = false;
    this.isPaused = false;
    this.pauseStartTime = 0;

    // DOM要素
    this.elTitle = document.getElementById("screen-title");
    this.elGame = document.getElementById("screen-game");
    this.elResult = document.getElementById("screen-result");
    this.elModalConfirm = document.getElementById("modal-confirm");
    this.elKanji = document.getElementById("kanji-display");
    this.elCategory = document.getElementById("meta-category");
    this.elSource = document.getElementById("meta-source");
    this.elSpeaker = document.getElementById("meta-speaker");
    this.elDifficulty = document.getElementById("meta-difficulty");
    this.elDialogueBox = document.getElementById("dialogue-box");
    this.elDialogueSpeaker = document.getElementById("dialogue-speaker");
    this.elDialogueSpeakerTag = document.getElementById("dialogue-speaker-tag");
    this.elDialogueText = document.getElementById("dialogue-text");
    this.elStage = document.getElementById("stage-text");
    this.elScore = document.getElementById("score-text");
    this.elCombo = document.getElementById("combo-badge");
    this.elTimerBar = document.getElementById("timer-bar");
    this.elInput = document.getElementById("game-input");
    this.elReadingPreview = document.getElementById("reading-preview");
    this.elOverlay = document.getElementById("feedback-overlay");
    this.elFeedbackText = document.getElementById("feedback-text");
    this.elKanjiBox = document.getElementById("kanji-box");

    this.initEventListeners();
    this.loadCSV();
    this.loadInfoTxtFiles();
  }

  // CSVパース (RFC4180風のクォート対応)
  async loadCSV() {
    try {
      const res = await fetch("questions.csv?t=" + Date.now());
      if (!res.ok) throw new Error("CSV fetch failed");
      const text = await res.text();
      this.questions = this.parseCSV(text);
      console.log(`Loaded ${this.questions.length} questions from CSV.`);
    } catch (e) {
      console.error("CSV読み込み失敗:", e);
    }
  }

  // 外部テキストファイル（UPDATES.txt, README.txt, CREDITS.txt）の動的読み込み
  async loadInfoTxtFiles() {
    const files = [
      { id: "txt-content-updates", path: "UPDATES.txt" },
      { id: "txt-content-readme", path: "README.txt" },
      { id: "txt-content-credits", path: "CREDITS.txt" }
    ];

    for (const item of files) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      try {
        const res = await fetch(`${item.path}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        el.textContent = text.trim();
      } catch (e) {
        console.warn(`${item.path} 読み込み失敗:`, e);
        el.textContent = "※ 情報の読み込みに失敗しました。";
      }
    }
  }

  parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length <= 1) return [];

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // カンマ分割（クォート内のカンマに対応）
      const cols = [];
      let inQuote = false;
      let buffer = "";

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          cols.push(buffer.trim());
          buffer = "";
        } else {
          buffer += char;
        }
      }
      cols.push(buffer.trim());

      // id,kanji,ruby,difficulty,category,source,speaker,sentence/hint
      if (cols.length >= 3) {
        const rawRuby = cols[2].replace(/^["']|["']$/g, "");
        // パイプ | またはスラッシュ / またはセミコロン ; または カンマ で分割
        const rubies = rawRuby.split(/[|/;,]/).map(r => r.trim()).filter(Boolean);

        result.push({
          id: cols[0] || String(i),
          kanji: cols[1] || "",
          rubies: rubies,
          difficulty: parseInt(cols[3], 10) || 1,
          category: cols[4] || "一般",
          source: cols[5] || "",
          speaker: cols[6] || "",
          sentence: cols[7] || ""
        });
      }
    }
    return result;
  }

  initEventListeners() {
    // カテゴリボタン選択
    document.querySelectorAll(".cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        window.soundManager.playClick();
        document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.selectedCategory = btn.dataset.cat;
      });
    });

    // 出題数ボタン選択
    document.querySelectorAll(".count-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        window.soundManager.playClick();
        document.querySelectorAll(".count-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        const countVal = btn.dataset.count;
        this.selectedCount = countVal === "ALL" ? "ALL" : parseInt(countVal, 10);
      });
    });

    // スタートボタン
    document.getElementById("btn-start").addEventListener("click", () => {
      window.soundManager.playClick();
      this.startGame();
    });

    // リトライボタン
    document.getElementById("btn-retry").addEventListener("click", () => {
      window.soundManager.playClick();
      this.startGame();
    });

    // タイトルへ戻る (リザルト画面)
    document.getElementById("btn-home").addEventListener("click", () => {
      window.soundManager.playClick();
      this.showTitle();
    });

    // タイトルへ戻る (プレイ中画面: 確認画面を開く ※タイマーは止めない)
    const btnGameHome = document.getElementById("btn-game-home");
    if (btnGameHome) {
      btnGameHome.addEventListener("click", () => {
        window.soundManager.playClick();
        this.openHomeConfirmModal();
      });
    }

    // モーダル: 続けるボタン
    const modalBtnCancel = document.getElementById("modal-btn-cancel");
    if (modalBtnCancel) {
      modalBtnCancel.addEventListener("click", () => {
        window.soundManager.playClick();
        this.closeHomeConfirmModal();
      });
    }

    // モーダル: タイトルへ戻るボタン
    const modalBtnConfirm = document.getElementById("modal-btn-confirm");
    if (modalBtnConfirm) {
      modalBtnConfirm.addEventListener("click", () => {
        window.soundManager.playClick();
        this.closeHomeConfirmModal();
        this.showTitle();
      });
    }

    // インフォモーダル開閉 (README / アップデート / クレジット)
    const modalInfo = document.getElementById("modal-info");
    const btnOpenInfo = document.getElementById("btn-open-info");
    const btnCloseInfo = document.getElementById("btn-close-info");
    const btnCloseInfoBottom = document.getElementById("btn-close-info-bottom");

    const openInfoModal = () => {
      window.soundManager.playClick();
      this.loadInfoTxtFiles(); // モーダルを開くたびに最新のtxtファイルを取得
      if (modalInfo) modalInfo.style.display = "flex";
    };
    const closeInfoModal = () => {
      window.soundManager.playClick();
      if (modalInfo) modalInfo.style.display = "none";
    };

    if (btnOpenInfo) btnOpenInfo.addEventListener("click", openInfoModal);
    if (btnCloseInfo) btnCloseInfo.addEventListener("click", closeInfoModal);
    if (btnCloseInfoBottom) btnCloseInfoBottom.addEventListener("click", closeInfoModal);

    if (modalInfo) {
      modalInfo.addEventListener("click", (e) => {
        if (e.target === modalInfo) closeInfoModal();
      });
    }

    // タブ切り替え
    const tabs = document.querySelectorAll(".schale-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        window.soundManager.playClick();
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const targetId = tab.dataset.tab;
        document.querySelectorAll(".info-tab-pane").forEach(pane => {
          pane.classList.remove("active");
        });
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add("active");
      });
    });

    // ESCキーでモーダルを閉じる
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (modalInfo && modalInfo.style.display === "flex") {
          closeInfoModal();
        } else if (this.elModalConfirm && this.elModalConfirm.style.display === "flex") {
          this.closeHomeConfirmModal();
        }
      }
    });

    // X (Twitter) シェア
    document.getElementById("btn-share").addEventListener("click", () => {
      this.shareResult();
    });

    // ミュート切り替え
    const muteBtn = document.getElementById("btn-mute");
    muteBtn.addEventListener("click", () => {
      const isMuted = window.soundManager.toggleMute();
      muteBtn.textContent = isMuted ? "🔇" : "🔊";
    });

    // 入力監視 (リアルタイムひらがな変換 & 判定)
    this.elInput.addEventListener("input", (e) => {
      if (!this.isAnswering || this.isPaused) return;
      const raw = e.target.value;
      const converted = window.RomajiUtil.convertToHiragana(raw);
      this.elReadingPreview.textContent = converted;

      // 自動判定
      this.checkAnswer(converted);
    });

    // Enterキーでも判定
    this.elInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.isAnswering && !this.isPaused) {
        const raw = this.elInput.value;
        const converted = window.RomajiUtil.convertToHiragana(raw);
        this.checkAnswer(converted, true);
      }
    });
  }

  startGame() {
    // カテゴリフィルタ
    let pool = this.questions;
    if (this.selectedCategory && this.selectedCategory !== "ALL") {
      pool = this.questions.filter(q => q.category === this.selectedCategory);
    }

    if (pool.length === 0) pool = this.questions;

    // シャッフル
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    // 出題数の決定
    let limit = shuffled.length;
    if (this.selectedCount !== "ALL") {
      limit = Math.min(this.selectedCount, shuffled.length);
    }

    this.currentQuestions = shuffled.slice(0, limit);
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correctCount = 0;
    this.history = [];
    this.isPaused = false;
    this.pauseStartTime = 0;
    this.closeHomeConfirmModal(false);

    this.elTitle.style.display = "none";
    this.elResult.style.display = "none";
    this.elGame.style.display = "flex";

    this.nextQuestion();
  }

  nextQuestion() {
    if (this.currentIndex >= this.currentQuestions.length) {
      this.endGame();
      return;
    }

    const q = this.currentQuestions[this.currentIndex];
    this.currentIndex++;
    this.isAnswering = true;

    // UI更新
    this.elStage.textContent = `MISSION ${this.currentIndex}/${this.currentQuestions.length}`;
    this.elScore.textContent = `${this.score.toLocaleString()} PT`;
    this.elKanji.textContent = q.kanji;
    
    // カテゴリ
    this.elCategory.textContent = q.category || "学園都市キヴォトス";

    // 難易度星マーク
    const stars = "★".repeat(Math.min(5, q.difficulty)) + "☆".repeat(Math.max(0, 5 - q.difficulty));
    this.elDifficulty.textContent = `Lv.${q.difficulty} ${stars}`;

    // 記載場所
    if (q.source) {
      this.elSource.textContent = q.source;
      this.elSource.style.display = "inline-flex";
    } else {
      this.elSource.style.display = "none";
    }

    // セリフ・問題文の表示
    if (q.sentence) {
      if (q.speaker) {
        this.elDialogueSpeaker.textContent = q.speaker;
        this.elDialogueSpeakerTag.style.display = "inline-flex";
      } else {
        this.elDialogueSpeakerTag.style.display = "none";
      }

      // セリフ内の対象漢字をハイライト表示
      let formattedText = q.sentence;
      if (q.kanji && formattedText.includes(q.kanji)) {
        formattedText = formattedText.replaceAll(q.kanji, `<span class="kanji-highlight">${q.kanji}</span>`);
      }
      this.elDialogueText.innerHTML = `「${formattedText}」`;
      this.elDialogueBox.style.display = "block";
    } else {
      this.elDialogueBox.style.display = "none";
    }

    this.elInput.value = "";
    this.elReadingPreview.textContent = "";
    this.elOverlay.className = "feedback-overlay";
    this.elTimerBar.className = "timer-bar";
    this.elTimerBar.style.width = "100%";

    // フォーカス
    this.elInput.focus();

    // 出題開始時刻を記録
    this.questionStartTime = Date.now();

    // タイマー開始
    this.startTimer();
  }

  startTimer() {
    clearInterval(this.timer);
    this.remainingMs = this.timeLimitMs;
    const interval = 50;

    this.timer = setInterval(() => {
      this.remainingMs -= interval;
      const pct = Math.max(0, (this.remainingMs / this.timeLimitMs) * 100);
      this.elTimerBar.style.width = `${pct}%`;

      if (pct < 30) {
        this.elTimerBar.className = "timer-bar danger";
      } else if (pct < 60) {
        this.elTimerBar.className = "timer-bar warning";
      }

      if (this.remainingMs <= 0) {
        clearInterval(this.timer);
        this.timeUp();
      }
    }, interval);
  }

  // タイトルへ戻る確認モーダルを開く (★タイマーは一切止めず通常進行！背景完全目隠しでカンニングを完全防止)
  // タイトルへ戻る確認モーダルを開く (タイマーは止めず、背景の問題も見えたまま進行)
  openHomeConfirmModal() {
    if (!this.isAnswering) return;

    if (this.elModalConfirm) {
      this.elModalConfirm.style.display = "flex";
    }

    // タイマーは止めずにそのまま進行（時間切れなら自動でMISS処理へ）
  }

  // タイトルへ戻る確認モーダルを閉じる
  closeHomeConfirmModal() {
    if (this.elModalConfirm) {
      this.elModalConfirm.style.display = "none";
    }
    this.elInput.focus();
  }

  checkAnswer(inputHiragana, isEnter = false) {
    if (!this.isAnswering) return;
    const q = this.currentQuestions[this.currentIndex - 1];

    const answers = q.rubies.map(a => a.trim());

    if (answers.includes(inputHiragana.trim())) {
      // 正解！
      clearInterval(this.timer);
      this.isAnswering = false;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.correctCount++;

      // スコア計算: 基本点(難易度に応じる) + 残り秒数ボーナス + コンボボーナス
      const basePts = 800 + (q.difficulty * 200);
      const timeBonus = Math.floor((this.remainingMs / 1000) * 80);
      const comboBonus = (this.combo - 1) * 150;
      const pts = basePts + timeBonus + comboBonus;
      this.score += pts;

      const elapsedSec = ((Date.now() - this.questionStartTime) / 1000).toFixed(3);

      this.history.push({
        kanji: q.kanji,
        rubies: q.rubies,
        isCorrect: true,
        user: inputHiragana,
        source: q.source,
        speaker: q.speaker,
        sentence: q.sentence,
        timeSec: elapsedSec
      });

      // 演出
      if (this.combo >= 2) {
        window.soundManager.playCombo();
        this.elCombo.textContent = `COMBO x${this.combo}!`;
        this.elCombo.classList.add("active");
      } else {
        window.soundManager.playCorrect();
        this.elCombo.classList.remove("active");
      }

      this.showFeedback("EXCELLENT!", "show-correct");

      setTimeout(() => {
        this.nextQuestion();
      }, 700);
    } else if (isEnter && inputHiragana.trim().length > 0) {
      // Enterキーで誤答だった場合の揺れアニメーション
      this.elInput.classList.remove("input-miss");
      void this.elInput.offsetWidth; // リフロー発生でアニメーション再発火
      this.elInput.classList.add("input-miss");
      window.soundManager.playTick();
    }
  }

  timeUp() {
    this.closeHomeConfirmModal(); // モーダルが開いていても時間切れで自動クローズ
    this.isAnswering = false;
    this.combo = 0;
    this.elCombo.classList.remove("active");
    window.soundManager.playWrong();

    const q = this.currentQuestions[this.currentIndex - 1];
    const elapsedSec = (this.timeLimitMs / 1000).toFixed(3);
    this.history.push({
      kanji: q.kanji,
      rubies: q.rubies,
      isCorrect: false,
      user: this.elReadingPreview.textContent || "無回答",
      source: q.source,
      speaker: q.speaker,
      sentence: q.sentence,
      timeSec: elapsedSec
    });

    // 画面揺れとミス演出
    this.elKanjiBox.classList.add("shake");
    setTimeout(() => this.elKanjiBox.classList.remove("shake"), 400);

    // 正解を赤字で表示
    this.elReadingPreview.textContent = `正解: ${q.rubies.join(" / ")}`;
    this.showFeedback("MISS...", "show-wrong");

    setTimeout(() => {
      this.nextQuestion();
    }, 1800);
  }

  showFeedback(text, className) {
    this.elFeedbackText.textContent = text;
    this.elOverlay.className = `feedback-overlay ${className}`;
  }

  endGame() {
    clearInterval(this.timer);
    window.soundManager.playVictory();

    this.elGame.style.display = "none";
    this.elResult.style.display = "flex";

    // リザルト集計
    const total = this.currentQuestions.length;
    const totalTimeSec = this.history.reduce((sum, item) => sum + parseFloat(item.timeSec || 0), 0);
    const avgTimeSec = total > 0 ? (totalTimeSec / total) : 0;
    const avgTimeStr = avgTimeSec.toFixed(3);

    // ランク判定（RANK_SETTINGS に基づいて判定）
    const rankInfo = evaluateGameRank(total, this.correctCount, avgTimeSec);
    this.currentRank = rankInfo;
    this.lastAvgTimeStr = avgTimeStr;

    const elBadge = document.getElementById("result-rank");
    elBadge.textContent = rankInfo.label;
    elBadge.className = `result-badge ${rankInfo.badgeClass}`;

    document.getElementById("res-score").textContent = this.score.toLocaleString();
    document.getElementById("res-correct").textContent = `${this.correctCount} / ${total}`;
    const elAvgTime = document.getElementById("res-avg-time");
    if (elAvgTime) elAvgTime.textContent = `${avgTimeStr}s`;
    document.getElementById("res-combo").textContent = this.maxCombo;

    // 振り返りリスト生成 (記載場所や話者、セリフも表示)
    const reviewList = document.getElementById("review-items");
    reviewList.innerHTML = "";
    this.history.forEach(item => {
      const div = document.createElement("div");
      div.className = "review-item";
      const metaInfo = [item.source, item.speaker ? `(${item.speaker})` : ""].filter(Boolean).join(" ");
      div.innerHTML = `
        <div class="review-left">
          <div class="review-q-header">
            <span class="review-mark">${item.isCorrect ? "⭕" : "❌"}</span>
            <span class="review-kanji"><strong>${item.kanji}</strong>（${item.rubies.join(" / ")}）</span>
            ${metaInfo ? `<span class="review-source">${metaInfo}</span>` : ""}
          </div>
          ${item.sentence ? `<div class="review-sentence">「${item.sentence}」</div>` : ""}
        </div>
        <div class="review-right">
          <span class="review-user-ans" style="color: ${item.isCorrect ? '#0284c7' : '#ef4444'}">
            ${item.user || "-"}
          </span>
          <span class="review-time">${item.timeSec}s</span>
        </div>
      `;
      reviewList.appendChild(div);
    });
  }

  showTitle() {
    clearInterval(this.timer);
    this.closeHomeConfirmModal();

    this.elGame.style.display = "none";
    this.elResult.style.display = "none";
    this.elTitle.style.display = "flex";
  }

  shareResult() {
    const catName = this.selectedCategory === "ALL" ? "全カテゴリ" : this.selectedCategory;
    const rankText = this.currentRank ? this.currentRank.label : "";
    const avgText = this.lastAvgTimeStr ? ` (平均: ${this.lastAvgTimeStr}s)` : "";
    const text = `【ブルアカ漢字検定】\n${rankText}\nカテゴリ: ${catName}\nスコア: ${this.score.toLocaleString()} PT\n正解数: ${this.correctCount}/${this.currentQuestions.length}${avgText}\n#ブルアカ #ブルーアーカイブ #ブルアカ漢字検定`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }
}

// 起動
window.addEventListener("DOMContentLoaded", () => {
  window.game = new KanjiGoGame();
});
