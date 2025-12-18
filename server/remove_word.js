const fs = require('fs');
const path = require('path');

const wordsFilePath = path.join(__dirname, 'words.json');

// Get the word to remove from command line arguments
const wordToRemove = process.argv[2];

if (!wordToRemove) {
  console.error('Usage: node remove_word.js <word_to_remove>');
  process.exit(1);
}

fs.readFile(wordsFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading words file:', err);
    return;
  }

  try {
    const wordsData = JSON.parse(data);
    const lowerWordToRemove = wordToRemove.toLowerCase();

    let foundWord = false;
    let removedFromCategory = '';

    // Search through all categories and remove the word pair
    for (const category of wordsData.categories) {
      const originalLength = category.words.length;

      category.words = category.words.filter(pair =>
        pair.civilian.toLowerCase() !== lowerWordToRemove &&
        pair.undercover.toLowerCase() !== lowerWordToRemove
      );

      if (category.words.length < originalLength) {
        foundWord = true;
        removedFromCategory = category.name;
        break;
      }
    }

    if (!foundWord) {
      console.log(`Word "${wordToRemove}" not found in any category.`);
      return;
    }

    // Remove empty categories (optional - you can comment this out if you want to keep empty categories)
    wordsData.categories = wordsData.categories.filter(cat => cat.words.length > 0);

    fs.writeFile(wordsFilePath, JSON.stringify(wordsData, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing to words file:', writeErr);
        return;
      }
      console.log(`Successfully removed the word pair containing "${wordToRemove}" from category "${removedFromCategory}".`);
    });
  } catch (parseErr) {
    console.error('Error parsing words.json:', parseErr);
  }
});
