import fs from 'fs';
import jison from 'jison';

function generate(source, destination) {
    console.info('Generating parser for', source);
    const grammar = fs.readFileSync(source, { encoding: 'utf-8' });
    const parser = new jison.Parser(grammar, { moduleType: 'es' }).generate();
    fs.writeFileSync(destination, parser, { encoding: 'utf-8' });
}

generate('azure-search-filter.jison', 'azure-search-filter.generated.js');
generate('azure-search-orderby.jison', 'azure-search-orderby.generated.js');
generate('azure-search-select.jison', 'azure-search-select.generated.js');
