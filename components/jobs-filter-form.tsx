import { MatchLevel, SourceName } from '@prisma/client';
import { DEFAULT_SEARCH_CONFIG } from '@/src/config/default-search-config';
import { formatLabel } from '@/src/lib/labels';

export function JobsFilterForm({
  defaults
}: {
  defaults: Record<string, string | undefined>;
}) {
  return (
    <form className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-card md:grid-cols-7" method="get">
      <input
        name="keyword"
        defaultValue={defaults.keyword}
        placeholder="Keyword (SQL, Power BI, insights...)"
        className="md:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />

      <select
        name="source"
        defaultValue={defaults.source}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">All Sources</option>
        {Object.values(SourceName)
          .filter((x) => x !== SourceName.MOCK && DEFAULT_SEARCH_CONFIG.includedSources.includes(x))
          .map((source) => (
            <option key={source} value={source}>
              {formatLabel(source)}
            </option>
          ))}
      </select>

      <select
        name="dateRange"
        defaultValue={defaults.dateRange ?? 'last7'}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="last1">Past 24 hours</option>
        <option value="last3">Past 3 days</option>
        <option value="last7">Past 7 days</option>
        <option value="sinceMar2026">Since 1 Mar 2026</option>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last14">Last 14 days</option>
        <option value="last30">Last 30 days</option>
        <option value="sinceFeb9">Since 9 Feb 2026</option>
        <option value="sinceFeb2026">Since 1 Feb 2026</option>
        <option value="since2026">Since 1 Jan 2026</option>
        <option value="all">All</option>
      </select>

      <select
        name="matchLevel"
        defaultValue={defaults.matchLevel}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">All Match Levels</option>
        {Object.values(MatchLevel)
          .filter((level) => level !== MatchLevel.EXCLUDE)
          .map((level) => (
          <option key={level} value={level}>
            {formatLabel(level)}
          </option>
          ))}
      </select>

      <select
        name="matchBucket"
        defaultValue={defaults.matchBucket}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">All CV Buckets</option>
        <option value="CV_MATCH,GOOD_MATCH">CV Match + Good Match</option>
        <option value="CV_MATCH">CV Match</option>
        <option value="GOOD_MATCH">Good Match</option>
        <option value="LESS_MATCH">Less Match</option>
        <option value="LOW_MATCH">Low Match</option>
        <option value="EXCLUDE">Exclude Bucket Only</option>
      </select>

      <input
        name="minScore"
        type="number"
        min={0}
        max={100}
        defaultValue={defaults.minScore ?? '0'}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        placeholder="Min priority"
      />

      <div className="flex items-center gap-3 md:col-span-6">
        <input type="hidden" name="goodMatchOnly" value="false" />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            name="goodMatchOnly"
            value="true"
            defaultChecked={defaults.goodMatchOnly === 'true'}
          />
          Good match only
        </label>

        <input type="hidden" name="includeStretch" value="false" />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            name="includeStretch"
            value="true"
            defaultChecked={defaults.includeStretch !== 'false'}
          />
          Include stretch
        </label>

        <input type="hidden" name="includeContract" value="false" />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            name="includeContract"
            value="true"
            defaultChecked={defaults.includeContract !== 'false'}
          />
          Include contract
        </label>

        <input type="hidden" name="unreviewedOnly" value="false" />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            name="unreviewedOnly"
            value="true"
            defaultChecked={defaults.unreviewedOnly === 'true'}
          />
          Unreviewed only
        </label>

        <input type="hidden" name="collapseMultiLocationDuplicates" value="false" />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <input
            type="checkbox"
            name="collapseMultiLocationDuplicates"
            value="true"
            defaultChecked={defaults.collapseMultiLocationDuplicates === 'true'}
          />
          Collapse multi-location duplicates
        </label>

        <button
          type="submit"
          className="ml-auto rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Apply Filters
        </button>
      </div>
    </form>
  );
}
