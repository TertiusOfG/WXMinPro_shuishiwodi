const fs = require('fs');
const path = require('path');

const wordsFilePath = path.join(__dirname, 'words.json');

// Get words from command line arguments
const categoryName = process.argv[2];
const civilianWord = process.argv[3];
const undercoverWord = process.argv[4];

if (!categoryName || !civilianWord || !undercoverWord) {
  console.error('Usage: node add_word.js <category> <civilian_word> <undercover_word>');
  console.error('Example: node add_word.js 食物饮料 咖啡 茶');
  process.exit(1);
}

fs.readFile(wordsFilePath, 'utf8', (err, data) => {
  if (err) {
    if (err.code === 'ENOENT') {
      // If file doesn't exist, create it with the new category and pair
      const wordsData = {
        categories: [
          {
            name: categoryName,
            words: [{ civilian: civilianWord, undercover: undercoverWord }]
          }
        ]
      };
      fs.writeFile(wordsFilePath, JSON.stringify(wordsData, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          console.error('Error writing new words file:', writeErr);
          return;
        }
        console.log(`Successfully created category "${categoryName}" and added: {"civilian": "${civilianWord}", "undercover": "${undercoverWord}"}`);
      });
    } else {
      console.error('Error reading words file:', err);
    }
    return;
  }

  try {
    const wordsData = JSON.parse(data);

    // Check for duplicates across all categories (case-insensitive)
    const lowerCivilian = civilianWord.toLowerCase();
    const lowerUndercover = undercoverWord.toLowerCase();

    let isDuplicate = false;
    for (const category of wordsData.categories) {
      isDuplicate = category.words.some(pair =>
        pair.civilian.toLowerCase() === lowerCivilian ||
        pair.undercover.toLowerCase() === lowerCivilian ||
        pair.civilian.toLowerCase() === lowerUndercover ||
        pair.undercover.toLowerCase() === lowerUndercover
      );
      if (isDuplicate) break;
    }

    if (isDuplicate) {
      console.error('Error: One of the words already exists in the list.');
      process.exit(1);
    }

    // Find or create the category
    let category = wordsData.categories.find(cat => cat.name === categoryName);
    if (!category) {
      category = { name: categoryName, words: [] };
      wordsData.categories.push(category);
      console.log(`Created new category: "${categoryName}"`);
    }

    // Add the word pair to the category
    category.words.push({ civilian: civilianWord, undercover: undercoverWord });

    fs.writeFile(wordsFilePath, JSON.stringify(wordsData, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing to words file:', writeErr);
        return;
      }
      console.log(`Successfully added to category "${categoryName}": {"civilian": "${civilianWord}", "undercover": "${undercoverWord}"}`);
    });
  } catch (parseErr) {
    console.error('Error parsing words.json:', parseErr);
  }
});
