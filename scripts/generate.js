import fs from 'fs';
import jison from 'jison';

function generate(source, destination) {
    console.info('Generating parser for', source);
    const grammar = fs.readFileSync(source, { encoding: 'utf-8' });
    const parser = new jison.Parser(grammar, { moduleType: 'es' }).generate();
    fs.writeFileSync(destination, parser, { encoding: 'utf-8' });
}

generate('src/query-filter.jison', 'src/parsers/query-filter.js');
generate('src/query-orderby.jison', 'src/parsers/query-orderby.js');
generate('src/query-select.jison', 'src/parsers/query-select.js');
