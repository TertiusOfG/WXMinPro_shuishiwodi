const fs = require('fs');
const path = require('path');

const wordsFilePath = path.join(__dirname, 'words.json');

// Get words from command line arguments
const civilianWord = process.argv[2];
const undercoverWord = process.argv[3];

if (!civilianWord || !undercoverWord) {
  console.error('Usage: node add_word.js <civilian_word> <undercover_word>');
  process.exit(1);
}

fs.readFile(wordsFilePath, 'utf8', (err, data) => {
  if (err) {
    if (err.code === 'ENOENT') {
      // If file doesn't exist, create it with the new pair
      const words = [{ civilian: civilianWord, undercover: undercoverWord }];
      fs.writeFile(wordsFilePath, JSON.stringify(words, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          console.error('Error writing new words file:', writeErr);
          return;
        }
        console.log(`Successfully added: {"civilian": "${civilianWord}", "undercover": "${undercoverWord}"}`);
      });
    } else {
      console.error('Error reading words file:', err);
    }
    return;
  }

  try {
    const words = JSON.parse(data);

    // Check for duplicates (case-insensitive)
    const lowerCivilian = civilianWord.toLowerCase();
    const lowerUndercover = undercoverWord.toLowerCase();

    const isDuplicate = words.some(pair => 
      pair.civilian.toLowerCase() === lowerCivilian ||
      pair.undercover.toLowerCase() === lowerCivilian ||
      pair.civilian.toLowerCase() === lowerUndercover ||
      pair.undercover.toLowerCase() === lowerUndercover
    );

    if (isDuplicate) {
      console.error('Error: One of the words already exists in the list.');
      process.exit(1);
    }

    words.push({ civilian: civilianWord, undercover: undercoverWord });

    fs.writeFile(wordsFilePath, JSON.stringify(words, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing to words file:', writeErr);
        return;
      }
      console.log(`Successfully added: {"civilian": "${civilianWord}", "undercover": "${undercoverWord}"}`);
    });
  } catch (parseErr) {
    console.error('Error parsing words.json:', parseErr);
  }
});
