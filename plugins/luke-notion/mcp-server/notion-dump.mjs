export function flattenProp(v) {
  if (!v || typeof v !== 'object' || !('type' in v)) return v;
  switch (v.type) {
    case 'title':             return v.title.map(t => t.plain_text).join('');
    case 'rich_text':         return v.rich_text.map(t => t.plain_text).join('');
    case 'select':            return v.select?.name ?? null;
    case 'multi_select':      return v.multi_select.map(s => s.name);
    case 'date':              return v.date?.start ?? null;
    case 'checkbox':          return v.checkbox;
    case 'number':            return v.number;
    case 'people':            return v.people.map(p => p.id);
    case 'relation':          return v.relation.map(r => r.id);
    case 'url':               return v.url;
    case 'email':             return v.email;
    case 'phone_number':      return v.phone_number;
    case 'created_time':      return v.created_time;
    case 'last_edited_time':  return v.last_edited_time;
    case 'unique_id':         return v.unique_id
                                  ? `${v.unique_id.prefix ?? ''}${v.unique_id.number}`
                                  : null;
    case 'formula':           return v.formula?.[v.formula.type] ?? null;
    case 'rollup':            return v.rollup?.[v.rollup.type] ?? null;
    case 'status':            return v.status?.name ?? null;
    default:                  return v;
  }
}
