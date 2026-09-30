/**
 * ブルアカ漢字でGO! - ゲームエンジン (新CSVフォーマット対応版)
 */

class KanjiGoGame {
  constructor() {
    this.questions = [];
    this.selectedDifficulty = "ALL";
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

    // DOM要素
    this.elTitle = document.getElementById("screen-title");
    this.elGame = document.getElementById("screen-game");
    this.elResult = document.getElementById("screen-result");
    this.elKanji = document.getElementById("kanji-display");
    this.elCategory = document.getElementById("meta-category");
    this.elSource = document.getElementById("meta-source");
    this.elSpeaker = document.getElementById("meta-speaker");
    this.elDifficulty = document.getElementById("meta-difficulty");
    this.elHint = document.getElementById("meta-hint");
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

      // id,kanji,ruby,difficulty,category,source,speaker,hint
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
          hint: cols[7] || ""
        });
      }
    }
    return result;
  }

  initEventListeners() {
    // 難易度ボタン選択
    document.querySelectorAll(".diff-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        window.soundManager.playClick();
        document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.selectedDifficulty = btn.dataset.diff;
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

    // タイトルへ戻る
    document.getElementById("btn-home").addEventListener("click", () => {
      window.soundManager.playClick();
      this.showTitle();
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
      if (!this.isAnswering) return;
      const raw = e.target.value;
      const converted = window.RomajiUtil.convertToHiragana(raw);
      this.elReadingPreview.textContent = converted;

      // 自動判定
      this.checkAnswer(converted);
    });

    // Enterキーでも判定
    this.elInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.isAnswering) {
        const raw = this.elInput.value;
        const converted = window.RomajiUtil.convertToHiragana(raw);
        this.checkAnswer(converted, true);
      }
    });
  }

  startGame() {
    // 難易度フィルタ
    let pool = this.questions;
    if (this.selectedDifficulty === "EASY") {
      pool = this.questions.filter(q => q.difficulty <= 2);
    } else if (this.selectedDifficulty === "HARD") {
      pool = this.questions.filter(q => q.difficulty === 3);
    } else if (this.selectedDifficulty === "VERY_HARD") {
      pool = this.questions.filter(q => q.difficulty >= 4);
    }

    if (pool.length === 0) pool = this.questions;

    // シャッフルして最大10問抽出
    this.currentQuestions = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correctCount = 0;
    this.history = [];

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
      this.elSource.textContent = `📖 ${q.source}`;
      this.elSource.style.display = "inline-flex";
    } else {
      this.elSource.style.display = "none";
    }

    // 誰の発言
    if (q.speaker) {
      this.elSpeaker.textContent = `💬 ${q.speaker}`;
      this.elSpeaker.style.display = "inline-flex";
    } else {
      this.elSpeaker.style.display = "none";
    }

    // ヒント
    if (q.hint) {
      this.elHint.textContent = `💡 ${q.hint}`;
      this.elHint.style.display = "inline-flex";
    } else {
      this.elHint.style.display = "none";
    }

    this.elInput.value = "";
    this.elReadingPreview.textContent = "";
    this.elOverlay.className = "feedback-overlay";
    this.elTimerBar.className = "timer-bar";
    this.elTimerBar.style.width = "100%";

    // フォーカス
    this.elInput.focus();

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

      this.history.push({
        kanji: q.kanji,
        rubies: q.rubies,
        isCorrect: true,
        user: inputHiragana,
        source: q.source,
        speaker: q.speaker
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
    }
  }

  timeUp() {
    this.isAnswering = false;
    this.combo = 0;
    this.elCombo.classList.remove("active");
    window.soundManager.playWrong();

    const q = this.currentQuestions[this.currentIndex - 1];
    this.history.push({
      kanji: q.kanji,
      rubies: q.rubies,
      isCorrect: false,
      user: this.elReadingPreview.textContent || "無回答",
      source: q.source,
      speaker: q.speaker
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
    const rate = Math.round((this.correctCount / total) * 100);

    const elBadge = document.getElementById("result-rank");
    if (rate === 100) {
      elBadge.textContent = "RANK: S (PERFECT!)";
      elBadge.className = "result-badge clear";
    } else if (rate >= 70) {
      elBadge.textContent = "RANK: A (CLEAR!)";
      elBadge.className = "result-badge clear";
    } else if (rate >= 40) {
      elBadge.textContent = "RANK: B";
      elBadge.className = "result-badge clear";
    } else {
      elBadge.textContent = "RANK: C (FAILED)";
      elBadge.className = "result-badge failed";
    }

    document.getElementById("res-score").textContent = this.score.toLocaleString();
    document.getElementById("res-correct").textContent = `${this.correctCount} / ${total}`;
    document.getElementById("res-combo").textContent = this.maxCombo;

    // 振り返りリスト生成 (記載場所や話者も表示)
    const reviewList = document.getElementById("review-items");
    reviewList.innerHTML = "";
    this.history.forEach(item => {
      const div = document.createElement("div");
      div.className = "review-item";
      const metaInfo = [item.source, item.speaker ? `(${item.speaker})` : ""].filter(Boolean).join(" ");
      div.innerHTML = `
        <div class="review-left">
          <span class="review-mark">${item.isCorrect ? "⭕" : "❌"}</span>
          <span class="review-kanji"><strong>${item.kanji}</strong>（${item.rubies.join(" / ")}）</span>
          ${metaInfo ? `<span class="review-source">${metaInfo}</span>` : ""}
        </div>
        <div class="review-right" style="color: ${item.isCorrect ? '#0284c7' : '#ef4444'}">
          ${item.user || "-"}
        </div>
      `;
      reviewList.appendChild(div);
    });
  }

  showTitle() {
    clearInterval(this.timer);
    this.elGame.style.display = "none";
    this.elResult.style.display = "none";
    this.elTitle.style.display = "flex";
  }

  shareResult() {
    const text = `【ブルアカ漢字でGO!】\n難易度: ${this.selectedDifficulty}\nスコア: ${this.score.toLocaleString()} PT\n正解数: ${this.correctCount}/${this.currentQuestions.length} (最大コンボ: ${this.maxCombo})\n#ブルアカ #ブルーアーカイブ #ブルアカ漢字でGO`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }
}

// 起動
window.addEventListener("DOMContentLoaded", () => {
  window.game = new KanjiGoGame();
});
