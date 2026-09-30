/**
 * ブルアカ漢字でGO! - ローマ字・かな変換ユーティリティ
 */
const ROMAJI_TABLE = [
  // 3文字
  { r: "kya", h: "きゃ" }, { r: "kyu", h: "きゅ" }, { r: "kyo", h: "きょ" }, { r: "kye", h: "きぇ" }, { r: "kyi", h: "きぃ" },
  { r: "sya", h: "しゃ" }, { r: "syu", h: "しゅ" }, { r: "syo", h: "しょ" }, { r: "sye", h: "しぇ" },
  { r: "sha", h: "しゃ" }, { r: "shu", h: "しゅ" }, { r: "sho", h: "しょ" }, { r: "she", h: "しぇ" },
  { r: "tya", h: "ちゃ" }, { r: "tyu", h: "ちゅ" }, { r: "tyo", h: "ちょ" }, { r: "tye", h: "ちぇ" },
  { r: "cha", h: "ちゃ" }, { r: "chu", h: "ちゅ" }, { r: "cho", h: "ちょ" }, { r: "che", h: "ちぇ" },
  { r: "nya", h: "にゃ" }, { r: "nyu", h: "にゅ" }, { r: "nyo", h: "にょ" }, { r: "nye", h: "にぇ" },
  { r: "hya", h: "ひゃ" }, { r: "hyu", h: "ひゅ" }, { r: "hyo", h: "ひょ" }, { r: "hye", h: "ひぇ" },
  { r: "mya", h: "みゃ" }, { r: "myu", h: "みゅ" }, { r: "myo", h: "みょ" }, { r: "mye", h: "みぇ" },
  { r: "rya", h: "りゃ" }, { r: "ryu", h: "りゅ" }, { r: "ryo", h: "りょ" }, { r: "rye", h: "りぇ" },
  { r: "gya", h: "ぎゃ" }, { r: "gyu", h: "ぎゅ" }, { r: "gyo", h: "ぎょ" },
  { r: "zya", h: "じゃ" }, { r: "zyu", h: "じゅ" }, { r: "zyo", h: "じょ" },
  { r: "ja", h: "じゃ" }, { r: "ju", h: "じゅ" }, { r: "jo", h: "じょ" }, { r: "je", h: "じぇ" },
  { r: "bya", h: "びゃ" }, { r: "byu", h: "びゅ" }, { r: "byo", h: "びょ" },
  { r: "pya", h: "ぴゃ" }, { r: "pyu", h: "ぴゅ" }, { r: "pyo", h: "ぴょ" },
  { r: "dya", h: "ぢゃ" }, { r: "dyu", h: "ぢゅ" }, { r: "dyo", h: "ぢょ" },
  { r: "tsu", h: "つ" }, { r: "chi", h: "ち" }, { r: "shi", h: "し" },
  { r: "xya", h: "ゃ" }, { r: "xyu", h: "ゅ" }, { r: "xyo", h: "ょ" }, { r: "xtu", h: "っ" }, { r: "xtsu", h: "っ" },
  { r: "ltu", h: "っ" }, { r: "ltsu", h: "っ" },
  // 2文字
  { r: "ka", h: "か" }, { r: "ki", h: "き" }, { r: "ku", h: "く" }, { r: "ke", h: "け" }, { r: "ko", h: "こ" },
  { r: "sa", h: "さ" }, { r: "si", h: "し" }, { r: "su", h: "す" }, { r: "se", h: "せ" }, { r: "so", h: "そ" },
  { r: "ta", h: "た" }, { r: "ti", h: "ち" }, { r: "tu", h: "つ" }, { r: "te", h: "て" }, { r: "to", h: "と" },
  { r: "na", h: "な" }, { r: "ni", h: "に" }, { r: "nu", h: "ぬ" }, { r: "ne", h: "ね" }, { r: "no", h: "の" },
  { r: "ha", h: "は" }, { r: "hi", h: "ひ" }, { r: "hu", h: "ふ" }, { r: "fu", h: "ふ" }, { r: "he", h: "へ" }, { r: "ho", h: "ほ" },
  { r: "ma", h: "ま" }, { r: "mi", h: "み" }, { r: "mu", h: "む" }, { r: "me", h: "め" }, { r: "mo", h: "も" },
  { r: "ya", h: "や" }, { r: "yu", h: "ゆ" }, { r: "yo", h: "よ" },
  { r: "ra", h: "ら" }, { r: "ri", h: "り" }, { r: "ru", h: "る" }, { r: "re", h: "れ" }, { r: "ro", h: "ろ" },
  { r: "wa", h: "わ" }, { r: "wo", h: "を" }, { r: "nn", h: "ん" },
  { r: "ga", h: "が" }, { r: "gi", h: "ぎ" }, { r: "gu", h: "ぐ" }, { r: "ge", h: "げ" }, { r: "go", h: "ご" },
  { r: "za", h: "ざ" }, { r: "zi", h: "じ" }, { r: "ji", h: "じ" }, { r: "zu", h: "ず" }, { r: "ze", h: "ぜ" }, { r: "zo", h: "ぞ" },
  { r: "da", h: "だ" }, { r: "di", h: "ぢ" }, { r: "du", h: "づ" }, { r: "de", h: "で" }, { r: "do", h: "ど" },
  { r: "ba", h: "ば" }, { r: "bi", h: "び" }, { r: "bu", h: "ぶ" }, { r: "be", h: "べ" }, { r: "bo", h: "ぼ" },
  { r: "pa", h: "ぱ" }, { r: "pi", h: "ぴ" }, { r: "pu", h: "ぷ" }, { r: "pe", h: "ぺ" }, { r: "po", h: "ぽ" },
  { r: "la", h: "ぁ" }, { r: "li", h: "ぃ" }, { r: "lu", h: "ぅ" }, { r: "le", h: "ぇ" }, { r: "lo", h: "ぉ" },
  { r: "xa", h: "ぁ" }, { r: "xi", h: "ぃ" }, { r: "xu", h: "ぅ" }, { r: "xe", h: "ぇ" }, { r: "xo", h: "ぉ" },
  // 1文字
  { r: "a", h: "あ" }, { r: "i", h: "い" }, { r: "u", h: "う" }, { r: "e", h: "え" }, { r: "o", h: "お" },
  { r: "-", h: "ー" }
];

/**
 * 入力文字列をひらがなに変換（ローマ字・カタカナ対応）
 */
function convertToHiragana(text) {
  if (!text) return "";
  let str = text.toLowerCase();

  // カタカナをひらがなに変換
  str = str.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });

  // ローマ字が含まれていない場合はそのまま返す
  if (!/[a-z]/.test(str)) {
    return str;
  }

  let result = "";
  let i = 0;
  while (i < str.length) {
    // 促音判定 (例: kk, tt, ss)
    if (i + 1 < str.length && str[i] === str[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(str[i]) && str[i] !== 'n') {
      result += "っ";
      i++;
      continue;
    }

    // テーブルマッチ (最長一致)
    let matched = false;
    for (const rule of ROMAJI_TABLE) {
      if (str.startsWith(rule.r, i)) {
        result += rule.h;
        i += rule.r.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // n 単体で次が母音/y/n以外、または末尾なら「ん」
      if (str[i] === 'n') {
        const next = str[i + 1];
        if (!next || !/[aiueoyn]/.test(next)) {
          result += "ん";
          i++;
          continue;
        }
      }
      result += str[i];
      i++;
    }
  }
  return result;
}

window.RomajiUtil = { convertToHiragana };
