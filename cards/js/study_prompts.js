// Optional presentations of existing meaning checks. Keep the Run's word, queue and scoring.
export const ORIGINALS_BETWEEN_PROMPTS = 6;
const ORDER = ['meaning-to-word', 'similar-words', 'meaning-to-word', 'sentence-meaning', 'meaning-to-word'];
const PAIRS = Object.fromEntries([
  ['borrow', 'lend'], ['quiet', 'quite'], ['lose', 'loose'], ['ship', 'sheep'],
  ['walk', 'work'], ['weather', 'whether'], ['accept', 'except'], ['desert', 'dessert'],
  ['hear', 'listen'], ['bring', 'take'], ['arrive', 'leave'], ['floor', 'flower'],
  ['think', 'thing'], ['read', 'ride'],
].flatMap(([a,b]) => [[a,b],[b,a]]));

// [before, exact highlighted form, after, expected catalogue gloss, two context-specific distractors]
const SENTENCES = {
  arrive: ['We ', 'arrive', ' at school at eight.', '도착하다', '떠나다', '기다리다'],
  bat: ['A ', 'bat', ' flew out of the cave.', '박쥐', '나비', '갈매기'],
  bear: ['A ', 'bear', ' slept in the forest.', '곰', '여우', '사슴'],
  book: ['I read a ', 'book', ' before bed.', '책', '편지', '일기'],
  borrow: ['May I ', 'borrow', ' your pencil?', '빌리다', '빌려주다', '버리다'],
  break: ['Don’t ', 'break', ' the glass!', '깨다', '씻다', '옮기다'],
  bring: ['Can you ', 'bring', ' me a towel?', '가져오다', '가지고 가다', '찾다'],
  change: ['Let’s ', 'change', ' the rules.', '바꾸다', '설명하다', '적다'],
  choose: ['You can ', 'choose', ' one toy.', '선택하다', '숨기다', '세다'],
  close: ['Please ', 'close', ' the door.', '닫다', '열다', '두드리다'],
  cold: ['The water is ', 'cold', '.', '차가운', '따뜻한', '깊은'],
  desert: ['A camel lives in the ', 'desert', '.', '사막', '숲', '늪'],
  dessert: ['We had ice cream for ', 'dessert', '.', '후식', '아침 식사', '저녁 식사'],
  drive: ['Dad will ', 'drive', ' the car.', '운전하다', '고치다', '씻다'],
  fair: ['Both teams get a ', 'fair', ' chance.', '공평한', '위험한', '필요한'],
  fall: ['The leaves ', 'fall', ' from the tree.', '떨어지다', '올라가다', '날아오르다'],
  fan: ['Turn on the ', 'fan', '. It’s hot!', '선풍기', '난로', '전등'],
  floor: ['My shoes are on the ', 'floor', '.', '바닥', '천장', '벽'],
  hard: ['We work ', 'hard', ' at school.', '열심히', '천천히', '조용히'],
  kind: ['Our teacher is very ', 'kind', '.', '친절한', '엄한', '바쁜'],
  leave: ['We ', 'leave', ' home at seven.', '떠나다', '도착하다', '머무르다'],
  lend: ['Can you ', 'lend', ' me your bike?', '빌려주다', '빌리다', '사다'],
  light: ['I ', 'light', ' a candle.', '불을 붙이다', '불을 끄다', '깨뜨리다'],
  listen: ['Please ', 'listen', ' to the story.', '귀 기울여 듣다', '따라 말하다', '소리 내어 읽다'],
  lose: ['Try not to ', 'lose', ' your key.', '잃어버리다', '빌리다', '숨기다'],
  match: ['Can you ', 'match', ' the two socks?', '짝을 맞추다', '색을 칠하다', '반으로 나누다'],
  park: ['We play in the ', 'park', '.', '공원', '정류장', '주차장'],
  quiet: ['The room is ', 'quiet', ' now.', '조용한', '시끄러운', '밝은'],
  read: ['I ', 'read', ' a letter from my friend.', '읽다', '쓰다', '보내다'],
  ride: ['We ', 'ride', ' our bikes to school.', '타다', '밀다', '빌리다'],
  right: ['You found the ', 'right', ' answer.', '옳은', '오른쪽', '틀린'],
  ship: ['A big ', 'ship', ' crossed the sea.', '큰 배', '비행기', '기차'],
  spring: ['We filled a bottle at the ', 'spring', '.', '샘', '바다', '봄'],
  tell: ['Can you ', 'tell', ' me your name?', '말해 주다', '적어 주다', '잊어버리다'],
  train: ['We took the ', 'train', ' to town.', '기차', '자전거', '배'],
  wear: ['I ', 'wear', ' a coat in winter.', '입고 있다', '벗다', '빌리다'],
  wind: ['The ', 'wind', ' blew my hat away.', '바람', '비', '안개'],
  work: ['They ', 'work', ' at the post office.', '일하다', '놀다', '쉬다'],
};

function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, '');
}

function reverseChoices(word, options, byId) {
  // Concrete one-word nouns and distinct catalogue glosses keep reverse prompts unambiguous.
  if (word.pos !== '명사' || !/^[a-z]+$/i.test(word.form) || !/^[가-힣 ]{1,14}$/.test(word.ko)) return null;
  const labels = options.map(option => byId[option.id]?.form);
  if (labels.length !== 3 || labels.some(label => !label || !/^[a-z]+$/i.test(label)) ||
      new Set(labels.map(normalize)).size !== 3) return null;
  const target = normalize(word.ko);
  if (options.some(option => {
    const other = normalize(option.ko);
    return option.id !== word.id && (target.includes(other) || other.includes(target));
  })) return null;
  return labels.map((label,i) => ({label,i}));
}

export function reviewPrompt(item, {byId, byForm, words, turn, slot, allowReverse}) {
  if (item.form !== 'check' || !['likely','review'].includes(item.role)) return null;
  const word = byId[item.id];
  if (!word?.ko || word.track === 'sight') return null;
  const correct = item.options?.findIndex(option => option.id === item.id) ?? -1;
  if (correct < 0 || item.options.length !== 3) return null;
  const wrong = (correct + 1) % item.options.length;
  const preferred = ORDER[slot % ORDER.length];
  if (preferred === 'similar-words') {
    const contrast = byForm.get(PAIRS[word.form]);
    if (contrast?.ko && contrast.track !== 'sight' && words[contrast.id] && normalize(contrast.ko) !== normalize(word.ko)) {
      const choices = [{label:word.form,i:correct},{label:contrast.form,i:wrong}];
      if (turn % 2) choices.reverse();
      return {type:preferred, choices, contrast};
    }
  }
  if (preferred === 'sentence-meaning') {
    const sentence = SENTENCES[word.form];
    if (sentence?.[3] === word.ko) {
      const alternatives = sentence.slice(4);
      const choices = item.options.map((_,i) => ({ label:i===correct ? word.ko : alternatives.shift(), i }));
      return {type:preferred, choices, sentence:sentence.slice(0,3)};
    }
  }
  if (preferred !== 'meaning-to-word' && !allowReverse) return null;
  const choices = reverseChoices(word, item.options, byId);
  return choices ? {type:'meaning-to-word', choices} : null;
}
