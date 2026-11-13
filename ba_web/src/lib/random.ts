const USERNAME_ADJECTIVES = [
  'Amber',
  'Brave',
  'Cosmic',
  'Daring',
  'Electric',
  'Frosty',
  'Golden',
  'Lucky',
  'Mighty',
  'Neon',
  'Radiant',
  'Swift',
];

const USERNAME_NOUNS = [
  'Badger',
  'Comet',
  'Falcon',
  'Fox',
  'Koala',
  'Lion',
  'Otter',
  'Panda',
  'Raven',
  'Tiger',
  'Wolf',
  'Wizard',
];

export const getRandomUsername = () => {
  const adjective = USERNAME_ADJECTIVES[Math.floor(Math.random() * USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[Math.floor(Math.random() * USERNAME_NOUNS.length)];
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `${adjective}${noun}${number}`;
};

export const getRandomBrightColor = () => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i += 1) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};
