import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { HTMLElement, parse } from 'node-html-parser';
import fetch from 'node-fetch';

const targetFolder = './src/stopwords';

console.log('Fetching stopwords from microsoft documentation...')
// NOTE: This page is different when loaded with javascript enabled.
fetch('https://learn.microsoft.com/en-us/azure/search/reference-stopwords')
  .then(r => {
    console.log('Result: ', r.statusText);
    return r.text();
  })
  .then(html => {
    console.log(`Got ${html.length} chars. Parsing as html...`);
    return parse(html);
  })
  .then(dom => {
    console.log('Looking for content...');
    return dom.querySelector('main .content');
  })
  .then(dom => {
    const results = [];

    let iso = null;
    for (const el of dom.childNodes) {
      if (!(el instanceof HTMLElement)) {
        continue;
      }

      if (el.tagName === 'H2' && el.id.endsWith('microsoft')) {
        const match = el.textContent.match(/\((?<iso>\w+(-\w+)?)\.microsoft\)/);
        iso = match.groups.iso ?? null;

        console.log('Found iso code:', iso);
      }

      if (iso && el.tagName === 'P') {
        const words = el.querySelectorAll('code')
          .map(e => e.textContent);

        console.log(`Found ${words.length} words for ${iso}.`);

        results.push({ iso, words });
        iso = null;
      }
    }

    return results;
  })
  .then(rs => {
    console.log('Saving...');

    if (!existsSync(targetFolder)) {
      mkdirSync(targetFolder)
    }

    for (const r of rs) {
      writeFileSync(`${targetFolder}/${r.iso}.json`, JSON.stringify(r.words, null, 2), { encoding: 'utf-8' });
    }

    console.log('Done!');
  });
