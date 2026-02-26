"use strict";

const el = (id) => document.getElementById(id);

const state = {
  level: 1,          // adaptive difficulty: 1..10
  streak: 0,
  score: 0,
  attempts: 0,
  current: null,     // { prompt, answerValue, hint }
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function simplifyFrac(n, d) {
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

// Parse answers like "12", "0.5", "  3/4 "
function parseNumberOrFraction(raw) {
  const s = String(raw).trim();
  if (!s) return null;

  // fraction?
  if (s.includes("/")) {
    const parts = s.split("/").map(p => p.trim());
    if (parts.length !== 2) return null;
    const n = Number(parts[0]);
    const d = Number(parts[1]);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return n / d;
  }

  const x = Number(s);
  if (!Number.isFinite(x)) return null;
  return x;
}

function setLevelLabel() {
  el("levelLabel").textContent = `Level ${state.level}`;
}

function setFeedback(msg, kind = "") {
  const f = el("feedback");
  f.textContent = msg;
  f.dataset.kind = kind; // CSS hook
}

function showHint(text) {
  const h = el("hint");
  if (!text) {
    h.classList.add("hidden");
    h.textContent = "";
    return;
  }
  h.classList.remove("hidden");
  h.textContent = text;
}

function updateStats() {
  el("score").textContent = String(state.score);
  el("attempts").textContent = String(state.attempts);
  el("streak").textContent = String(state.streak);
  setLevelLabel();
}

function nextQuestion() {
  const topic = el("topic").value;
  state.current = generateQuestion(topic, state.level);

  el("question").textContent = state.current.prompt;
  el("answer").value = "";
  el("answer").focus();
  showHint("");
  setFeedback("Type your answer and press Check.", "");
}

function checkAnswer() {
  if (!state.current) {
    setFeedback("Press Start to get a question first.", "warn");
    return;
  }

  const userVal = parseNumberOrFraction(el("answer").value);
  if (userVal === null) {
    setFeedback("I couldn't read that. Try a number like 12, 0.5, or 3/4.", "warn");
    return;
  }

  state.attempts += 1;

  const correct = state.current.answerValue;

  // Tolerance for decimals
  const tol = 1e-9;

  const isCorrect = Math.abs(userVal - correct) <= tol;

  if (isCorrect) {
    state.score += 1;
    state.streak += 1;

    // adaptive: after 2 in a row, level up
    if (state.streak % 2 === 0) state.level = clamp(state.level + 1, 1, 10);

    setFeedback("Correct ✅ Great job! Press Start / Next.", "ok");
    showHint("");
  } else {
    // adaptive: make it a bit easier
    state.streak = 0;
    state.level = clamp(state.level - 1, 1, 10);

    setFeedback("Not quite ❌ Try again or press Hint.", "bad");
  }

  updateStats();
}

function hint() {
  if (!state.current) return;
  showHint(state.current.hint);
}

/**
 * Question generator for Grades 3–6 topics.
 * Returns { prompt, answerValue, hint }
 */
function generateQuestion(topic, level) {
  switch (topic) {
    case "addsub": return genAddSub(level);
    case "multdiv": return genMultDiv(level);
    case "fractions": return genFractions(level);
    case "decimals": return genDecimals(level);
    case "order": return genOrder(level);
    case "word": return genWord(level);
    default: return genAddSub(level);
  }
}

function genAddSub(level) {
  // level controls number size
  const max = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000][level - 1];
  const a = randInt(0, max);
  const b = randInt(0, max);

  const doSub = Math.random() < 0.5;
  if (doSub) {
    const big = Math.max(a, b);
    const small = Math.min(a, b);
    return {
      prompt: `${big} − ${small} = ?`,
      answerValue: big - small,
      hint: "For subtraction: think “difference”. You can count up from the smaller number."
    };
  }
  return {
    prompt: `${a} + ${b} = ?`,
    answerValue: a + b,
    hint: "For addition: break numbers into tens/hundreds to add faster."
  };
}

function genMultDiv(level) {
  // early levels: times tables; later: 2–3 digit × 1–2 digit and division with remainders avoided
  const tableMax = clamp(6 + level, 7, 12);

  if (level <= 5) {
    const a = randInt(2, tableMax);
    const b = randInt(2, tableMax);
    return {
      prompt: `${a} × ${b} = ?`,
      answerValue: a * b,
      hint: "Use times tables. Try doubling/halving tricks (e.g., 6×8 = (3×8)×2)."
    };
  } else {
    const a = randInt(12, 99);
    const b = randInt(2, 12);
    const doDiv = Math.random() < 0.4;

    if (doDiv) {
      // make divisible
      const q = randInt(2, 12 + level);
      const d = randInt(2, 9 + Math.floor(level / 2));
      const n = q * d;
      return {
        prompt: `${n} ÷ ${d} = ?`,
        answerValue: q,
        hint: "Division is the reverse of multiplication: find the number that times the divisor gives the dividend."
      };
    }

    return {
      prompt: `${a} × ${b} = ?`,
      answerValue: a * b,
      hint: "Break it up: 37×6 = (30×6) + (7×6)."
    };
  }
}

function genFractions(level) {
  // start with equivalent fractions, then add/subtract like denominators, later unlike denominators
  const denomPoolEasy = [2, 3, 4, 5, 6, 8, 10, 12];
  const denomPoolHard = [6, 8, 9, 10, 12, 15, 16, 18, 20];

  if (level <= 3) {
    const d = denomPoolEasy[randInt(0, denomPoolEasy.length - 1)];
    const n = randInt(1, d - 1);
    const k = randInt(2, 4);
    const nn = n * k, dd = d * k;
    return {
      prompt: `Simplify the fraction: ${nn}/${dd}`,
      answerValue: n / d,
      hint: "Divide the top and bottom by the same number to simplify."
    };
  }

  const likeDen = Math.random() < 0.6 || level <= 6;
  if (likeDen) {
    const d = denomPoolEasy[randInt(0, denomPoolEasy.length - 1)];
    const a = randInt(1, d - 1);
    const b = randInt(1, d - 1);
    const opAdd = Math.random() < 0.5;
    const num = opAdd ? (a + b) : (a - b);
    const safeNum = num <= 0 ? (a + b) : num; // avoid negatives for primary
    const simp = simplifyFrac(safeNum, d);
    return {
      prompt: `${a}/${d} ${safeNum === (a + b) ? "+" : "−"} ${b}/${d} = ?  (Answer as a fraction or decimal)`,
      answerValue: simp.n / simp.d,
      hint: "Same denominator: add/subtract the numerators, keep the denominator."
    };
  } else {
    // unlike denominators
    const d1 = denomPoolHard[randInt(0, denomPoolHard.length - 1)];
    const d2 = denomPoolHard[randInt(0, denomPoolHard.length - 1)];
    const a = randInt(1, d1 - 1);
    const b = randInt(1, d2 - 1);
    const opAdd = true; // keep it simpler: addition
    const lcm = (d1 * d2) / gcd(d1, d2);
    const n = a * (lcm / d1) + b * (lcm / d2);
    const simp = simplifyFrac(n, lcm);
    return {
      prompt: `${a}/${d1} + ${b}/${d2} = ?  (Answer as a fraction or decimal)`,
      answerValue: simp.n / simp.d,
      hint: "Find a common denominator (LCM), convert both fractions, then add."
    };
  }
}

function genDecimals(level) {
  // level increases decimal places and operations
  const places = level <= 3 ? 1 : (level <= 7 ? 2 : 3);

  const scale = Math.pow(10, places);
  const a = randInt(1 * scale, 50 * scale) / scale;
  const b = randInt(1 * scale, 50 * scale) / scale;

  const op = level <= 3 ? "+" : (Math.random() < 0.5 ? "+" : "−");
  const big = Math.max(a, b);
  const small = Math.min(a, b);

  const prompt = op === "+"
    ? `${a.toFixed(places)} + ${b.toFixed(places)} = ?`
    : `${big.toFixed(places)} − ${small.toFixed(places)} = ?`;

  const answerValue = op === "+" ? (a + b) : (big - small);

  return {
    prompt,
    answerValue: Number(answerValue.toFixed(places)), // keep tidy
    hint: "Line up the decimal points before adding/subtracting."
  };
}

function genOrder(level) {
  // simple BEDMAS/PEMDAS
  const a = randInt(2, 5 + level);
  const b = randInt(2, 5 + level);
  const c = randInt(2, 5 + level);

  const kind = level <= 4 ? 1 : (Math.random() < 0.5 ? 2 : 3);

  if (kind === 1) {
    // a + b × c
    return {
      prompt: `${a} + ${b} × ${c} = ?`,
      answerValue: a + b * c,
      hint: "Do multiplication before addition."
    };
  }
  if (kind === 2) {
    // (a + b) × c
    return {
      prompt: `(${a} + ${b}) × ${c} = ?`,
      answerValue: (a + b) * c,
      hint: "Do brackets first."
    };
  }
  // a × b − c
  return {
    prompt: `${a} × ${b} − ${c} = ?`,
    answerValue: a * b - c,
    hint: "Multiply first, then subtract."
  };
}

function genWord(level) {
  // simple word problems; answer is numeric
  const kind = randInt(1, 3);

  if (kind === 1) {
    const packs = randInt(2, 4 + level);
    const each = randInt(3, 6 + level);
    return {
      prompt: `You have ${packs} packs of stickers. Each pack has ${each} stickers. How many stickers in total?`,
      answerValue: packs * each,
      hint: "Total = number of packs × stickers per pack."
    };
  }

  if (kind === 2) {
    const total = randInt(30, 60 + level * 10);
    const used = randInt(5, Math.floor(total * 0.6));
    return {
      prompt: `You had ${total} marbles. You gave away ${used}. How many marbles do you have left?`,
      answerValue: total - used,
      hint: "Left = total − given away."
    };
  }

  const total = randInt(24, 72 + level * 12);
  const groups = randInt(2, 6 + Math.floor(level / 2));
  const divisible = total - (total % groups);
  return {
    prompt: `${divisible} cupcakes are shared equally among ${groups} kids. How many cupcakes does each kid get?`,
    answerValue: divisible / groups,
    hint: "Equal sharing means division: total ÷ number of kids."
  };
}

// Wire up buttons
function resetAll() {
  state.level = 1;
  state.streak = 0;
  state.score = 0;
  state.attempts = 0;
  state.current = null;

  el("question").textContent = "Press “Start” to begin.";
  el("answer").value = "";
  showHint("");
  setFeedback("", "");
  updateStats();
}

window.addEventListener("DOMContentLoaded", () => {
  setLevelLabel();
  updateStats();

  el("startBtn").addEventListener("click", nextQuestion);
  el("checkBtn").addEventListener("click", checkAnswer);
  el("hintBtn").addEventListener("click", hint);
  el("resetBtn").addEventListener("click", resetAll);

  el("answer").addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkAnswer();
  });
});