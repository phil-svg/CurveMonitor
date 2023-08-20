export function topBestPerformingLabels(labelsOccurrence) {
    const topLabels = labelsOccurrence
        .map((label) => (Object.assign(Object.assign({}, label), { ratio: Number(((label.occurrences / label.numOfAllTx) * 100).toFixed(2)) }))) // calculate the ratio as a percentage with 2 decimal places
        .sort((a, b) => a.ratio - b.ratio) // sort in ascending order
        .slice(0, 10); // get the top 10
    return topLabels;
}
export function topWorstPerformingLabels(labelsOccurrence) {
    const topLabels = labelsOccurrence
        .filter((label) => label.numOfAllTx >= 12) // filter labels with at least 12 numOfAllTx
        .map((label) => (Object.assign(Object.assign({}, label), { ratio: Number(((label.occurrences / label.numOfAllTx) * 100).toFixed(2)) }))) // calculate the ratio as a percentage with 2 decimal places
        .sort((a, b) => b.ratio - a.ratio) // sort in descending order
        .slice(0, 10); // get the top 10
    return topLabels;
}
//# sourceMappingURL=Client.js.map