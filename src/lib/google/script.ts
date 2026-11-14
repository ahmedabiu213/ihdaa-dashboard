/**
 * The Google Ads Script the team pastes into Google Ads (Tools → Bulk actions → Scripts).
 * It reads daily spend per campaign (campaign level also covers Performance Max)
 * and posts it to the dashboard. Schedule: hourly.
 */
export function googleAdsScript(endpoint: string, secret: string) {
  return `// Ihdaa dashboard: send Google Ads spend (per campaign, per day).
// Schedule this script to run Hourly. For a one-time backfill set DAYS = 90 and click Run.
var ENDPOINT = '${endpoint}';
var SECRET = '${secret}';
var DAYS = 7;

function main() {
  var account = AdsApp.currentAccount();
  var tz = account.getTimeZone();
  var now = new Date();
  var to = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var from = Utilities.formatDate(new Date(now.getTime() - (DAYS - 1) * 86400000), tz, 'yyyy-MM-dd');

  var query = 'SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, ' +
    'metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign ' +
    "WHERE segments.date BETWEEN '" + from + "' AND '" + to + "'";

  var rows = [];
  var it = AdsApp.report(query).rows();
  while (it.hasNext()) {
    var r = it.next();
    rows.push({
      date: r['segments.date'],
      campaign_id: String(r['campaign.id']),
      campaign_name: r['campaign.name'],
      cost_micros: Number(r['metrics.cost_micros']),
      impressions: Number(r['metrics.impressions']),
      clicks: Number(r['metrics.clicks']),
      conversions: Number(r['metrics.conversions']),
      conversions_value: Number(r['metrics.conversions_value'])
    });
  }

  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + SECRET },
    payload: JSON.stringify({
      account: { id: account.getCustomerId(), name: account.getName(), currency: account.getCurrencyCode(), timezone: tz },
      from: from, to: to, rows: rows
    }),
    muteHttpExceptions: true
  });
  Logger.log('Sent ' + rows.length + ' rows (' + from + ' to ' + to + '): HTTP ' + res.getResponseCode() + ' ' + res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error('Dashboard rejected the data: ' + res.getContentText());
}
`;
}
