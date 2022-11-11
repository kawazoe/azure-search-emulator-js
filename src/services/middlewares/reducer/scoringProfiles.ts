import type { ODataSelect } from '../../../lib/odata';

import type { ScoringStrategies } from '../../scorer';
import type { DocumentMiddleware } from '../../searchBackend';

export function useScoringProfiles<T extends object, Keys extends ODataSelect<T>>(options: {
  scoringStrategies: ScoringStrategies<T>,
}): DocumentMiddleware<T, Keys> {
  return (next) => {
    return (acc, cur) => {
      cur.globalScore += options.scoringStrategies(cur.document.parsed, cur.scores);

      return next(acc, cur);
    };
  };
}