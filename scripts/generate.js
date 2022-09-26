import fs from 'fs';
import jison from 'jison';

function generate(source, destination) {
    console.info('Generating parser for', source);
    const grammar = fs.readFileSync(source, { encoding: 'utf-8' });
    const parser = new jison.Parser(grammar, { moduleType: 'es' }).generate();
    fs.writeFileSync(destination, parser, { encoding: 'utf-8' });
}

generate('query-filter.jison', 'query-filter.generated.js');
generate('query-orderby.jison', 'query-orderby.generated.js');
generate('query-select.jison', 'query-select.generated.js');
