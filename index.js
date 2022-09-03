import prompts from 'prompts';
import clipboard from 'clipboardy';

// square constants
const sq = {g: "🟩", b: "⬛", w: "⬜",}
const format = {up: 0, low: 1, title: 2, none: 3}

/**
 * Removes all non-alphabetical characters from a string
 * @param {string} str String to clean
 * @returns {string}
 */
function cleanString(str) {
    return str.replaceAll(/[^a-z]/gi, "")
}

/**
 * Formats a string in a specific case
 * @param {string} str String to format
 * @param {number} form Format enum value
 * @returns {string}
 */
function applyFormat(str, form) {
    switch(form) {
        case format.up:
            return str.toUpperCase();
        case format.low:
            return str.toLowerCase();
        case format.title:
            return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
        default:
            return str;
    } 
}

/**
 * Checks that the inputted Weaver guess sequence is valid  
 * Does not check that individual words are valid Weaver words
 * @param {string[]} seq Guess sequence
 * @param {string} start Starting word
 * @param {string} final Final (target) word
 * @param {number} len Game word length
 * @returns {boolean}
 */
function validateSequence(seq, start, final, len) {
    // add start and final as elements
    if (seq[0].toLowerCase() !== start.toLowerCase())
        seq.unshift(start)
    else
        seq[0] = start;

    if (seq[seq.length - 1].toLowerCase() !== final.toLowerCase())
        seq.push(final)
    else
        seq[seq.length - 1] = final;

    // check that sequence is valid
    for(let i = 1; i < seq.length; i++) {
        if (seq[i-1].length !== len || seq[i].length !== seq[i-1].length) {
            console.log(`Words must be ${len} letter${len == 1 ? "" : "s"} long`);
            return false;
        }

        let w1 = seq[i].split("");
        let w2 = seq[i-1].split("");
        let diff = 0;
        for(let j = 0; j < w1.length; j++) {
            diff += w1[j].toLowerCase() === w2[j].toLowerCase() ? 0 : 1;
        }
        if (diff !== 1) {
            console.log("Words must change by exactly one letter between guesses");
            return false;
        }
    }
    return true;
}

/**
 * Constructs a row corresponding to a Weaver guess
 * @param {string} guess Submitted guess
 * @param {string} final Final (target) word
 * @param {string} fillerTile Tile to use to mark letters that do not match
 * @param {boolean} hideInfo True to hide word and position change info, false otherwise
 * @returns {string}
 */
function constructWeaverTableRow(guess, final, fillerTile, hideInfo = true) {
    let count = 0;
    let gSplit = guess.split("");
    let fSplit = final.split("");
    let trueRow = [];

    for(let i = 0; i < guess.length; i++) {
        if (gSplit[i].toLowerCase() === fSplit[i].toLowerCase()) {
            count += 1;
            trueRow.push(sq.g);
        } else {
            trueRow.push(fillerTile);
        }
    }
    return `${sq.g.repeat(count)}${fillerTile.repeat(guess.length - count)} ${hideInfo ? "||" : ""}\`${guess}\`${hideInfo ? "||" : ""} ${hideInfo ? "||" : ""}${trueRow.join("")}${hideInfo ? "||" : ""}`;
}

/**
 * Constructs a full output table for a game of Weaver
 * @param {string[]} seq 
 * @param {number} optimal 
 * @returns {string}
 */
function constructWeaverTable(seq, optimal) {
    const date = new Date(Date.now());
    let output = `Weaver ${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
    if (optimal > 0) {
        output += ` ${seq.length - 1}/${optimal}`
    }
    for(let i = 0; i < seq.length; i++) {
        output += `\n${constructWeaverTableRow(seq[i], seq[seq.length - 1], (i === 0 ? sq.b : sq.w), (i !== 0 && i !== seq.length - 1))}`
    }
    return output;
}

/**
 * Gets prompts from the user, allowing them to create a Weaver table
 * @returns {object}
 */
async function getPrompts() {
    console.log();

    const onCancel = () => {
        console.log("Process aborted.")
        process.exit(0);
    }

    const options = await prompts({
        type: "select",
        name: "format",
        message: "Select word formatting:",
        choices: [
            {title: "UPPER", value: format.up},
            {title: "lower", value: format.low},
            {title: "Title", value: format.title},
            {title: "preSERVE", value: format.none}
        ],
        initial: 0,
    }, {onCancel});

    const start = await prompts({
        type: "text",
        name: "val",
        message: "Input starting word:",
        validate: input => cleanString(input).length > 0 ? true : "Starting word must be at least 1 letter long",
        format: input => applyFormat(cleanString(input), options.format)
    }, {onCancel});
    const wordLength = start.val.length;
    console.log(`Initialized Weaver Game with ${wordLength}-letter words\nStart: ${start.val}`);
    const final = await prompts({
        type: "text",
        name: "val",
        message: "Input final word:",
        validate: input => cleanString(input).length == wordLength ? true : `Words must be ${wordLength} letter${wordLength == 1 ? "" : "s"} long`,
        format: input => applyFormat(cleanString(input), options.format)
    }, {onCancel});
    console.log(`Final: ${final.val}`);
    const optimalNum = await prompts({
        type: "number",
        name: "val",
        message: "Input optimal solution length (0 to ignore):",
        min: 0,
        initial: 0,
    }, {onCancel});

    let seqLoop = true;
    let seq;
    while(seqLoop) {
        let seqRaw = await prompts({
            type: "list",
            name: "val",
            message: "Input guess sequence:",
            separator: " ",
        }, {onCancel});
        seq = seqRaw.val.map(e => applyFormat(cleanString(e), options.format))
        if(validateSequence(seq, start.val, final.val, wordLength)) {
            seqLoop = false;
            break;
        }
    }

    console.log(`Sequence: ${seq.join(", ")}`)
    const copy = await prompts({
        type: "confirm",
        name: "allow",
        message: `Copy output to clipboard?`,
    }, {onCancel});

    return {seq: seq, optimal: optimalNum.val, allow_copy: copy.allow}
}

// Runs the Weaver formatter
let inputs = await getPrompts()
let output = constructWeaverTable(inputs.seq, inputs.optimal)
console.log(`\n${output}\n`);
if(inputs.allow_copy) {
    clipboard.write(output).then(() => {
        console.log("Output copied to clipboard!")
    })
}