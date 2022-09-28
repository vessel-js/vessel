export const removeTrailingSlash = (str: string) => str.replace(/\/$/, '');

const WORD_SEPARATORS =
  /[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]+/;

export function toTitleCase(str: string) {
  const words = str.split(WORD_SEPARATORS);
  const len = words.length;
  const mappedWords = new Array(len);

  for (let i = 0; i < len; i++) {
    const word = words[i];
    if (word === '') continue;
    mappedWords[i] = word[0].toUpperCase() + word.slice(1);
  }

  return mappedWords.join(' ');
}
