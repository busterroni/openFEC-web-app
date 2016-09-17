import http

import furl
from webargs import fields
from webargs.flaskparser import use_kwargs
from flask import render_template, request, redirect, url_for, abort
from collections import OrderedDict

from openfecwebapp import views
from openfecwebapp import utils
from openfecwebapp import config
from openfecwebapp import constants
from openfecwebapp import api_caller
from openfecwebapp.app import app


@app.route('/')
def search():
    query = request.args.get('search')
    if query:
        result_type = request.args.get('search_type') or 'candidates'
        results = api_caller.load_search_results(query, result_type)
        return views.render_search_results(results, query, result_type)
    else:
        return render_template('landing.html',
            page='home',
            dates=utils.date_ranges(),
            totals= api_caller.landing_mock_data(),
            top_candidates_raising = api_caller.load_top_candidates('-receipts'),
            top_candidates_spending = api_caller.load_top_candidates('-disbursements'),
            top_pacs_raising = api_caller.load_top_pacs('-receipts'),
            top_pacs_spending = api_caller.load_top_pacs('-disbursements'),
            top_parties_raising = api_caller.load_top_parties('-receipts'),
            top_parties_spending = api_caller.load_top_parties('-disbursements'),
            title='Campaign finance data')

@app.route('/api/')
def api():
    """Redirect to API as described at
    https://18f.github.io/API-All-the-X/pages/developer_hub_kit.
    """
    return redirect(config.api_location, http.client.MOVED_PERMANENTLY)

@app.route('/developers/')
def developers():
    """Redirect to developer portal as described at
    https://18f.github.io/API-All-the-X/pages/developer_hub_kit.
    """
    url = furl.furl(config.api_location)
    url.path.add('developers')
    return redirect(url.url, http.client.MOVED_PERMANENTLY)

@app.route('/candidate/<c_id>/')
@use_kwargs({
    'cycle': fields.Int(),
    'election_full': fields.Bool(missing=True),
})
def candidate_page(c_id, cycle=None, election_full=True):
    """Fetch and render data for candidate detail page.

    :param int cycle: Optional cycle for associated committees and financials.
    :param bool election_full: Load full election period
    """
    candidate, committees, cycle = api_caller.load_with_nested(
        'candidate', c_id, 'committees',
        cycle=cycle, cycle_key='two_year_period',
        election_full=election_full,
    )
    if election_full and cycle and cycle not in candidate['election_years']:
        next_cycle = next(
            (
                year for year in sorted(candidate['election_years'])
                if year > cycle
            ),
            max(candidate['election_years']),
        )
        return redirect(
            url_for('candidate_page', c_id=c_id, cycle=next_cycle, election_full='true')
        )
    return views.render_candidate(candidate, committees, cycle, election_full)

@app.route('/committee/<c_id>/')
@use_kwargs({
    'cycle': fields.Int(),
})
def committee_page(c_id, cycle=None):
    """Fetch and render data for committee detail page.

    :param int cycle: Optional cycle for financials.
    """
    committee, candidates, cycle = api_caller.load_with_nested('committee', c_id, 'candidates', cycle)
    return views.render_committee(committee, candidates, cycle)

@app.route('/advanced/')
def advanced():
    return render_template(
        'advanced.html',
        title='Advanced data'
    )

@app.route('/candidates/')
def candidates():
    return render_template(
        'datatable.html',
        result_type='candidates',
        slug='candidates',
        title='Candidates',
        columns=constants.table_columns['candidates']
    )

@app.route('/candidates/<office>/')
def candidates_office(office):
    if office.lower() not in ['president', 'senate', 'house']:
        abort(404)
    return render_template(
        'datatable.html',
        result_type='candidates',
        title='candidates for ' + office,
        slug='candidates-office',
        table_context=OrderedDict([('office', office)]),
        columns=constants.table_columns['candidates-office-' + office.lower()]
    )

@app.route('/committees/')
def committees():
    return render_template(
        'datatable.html',
        result_type='committees',
        slug='committees',
        title='Committees',
        dates=utils.date_ranges(),
        columns=constants.table_columns['committees']
    )

@app.route('/receipts/')
def receipts():
    return render_template(
        'datatable.html',
        slug='receipts',
        title='Receipts',
        dates=utils.date_ranges(),
        columns=constants.table_columns['receipts']
    )

@app.route('/receipts/individual-contributions/')
def individual_contributions():
    return render_template(
        'datatable.html',
        result_type='receipts',
        title='Individual contributions',
        slug='individual-contributions',
        dates=utils.date_ranges(),
        columns=constants.table_columns['individual-contributions']
    )

@app.route('/disbursements/')
def disbursements():
    return render_template(
        'datatable.html',
        slug='disbursements',
        title='Disbursements',
        dates=utils.date_ranges(),
        columns=constants.table_columns['disbursements']
    )

@app.route('/filings/')
def filings():
    return render_template(
        'datatable.html',
        slug='filings',
        title='Filings',
        dates=utils.date_ranges(),
        result_type='committees',
        columns=constants.table_columns['filings']
    )

@app.route('/independent-expenditures/')
def independent_expenditures():
    return render_template(
        'datatable.html',
        slug='independent-expenditures',
        title='Independent expenditures',
        dates=utils.date_ranges(),
        columns=constants.table_columns['independent-expenditures']
    )

@app.route('/electioneering-communications/')
def electioneering_communications():
    return render_template(
        'datatable.html',
        slug='electioneering-communications',
        title='Electioneering communications',
        dates=utils.date_ranges(),
        columns=constants.table_columns['electioneering-communications']
    )

@app.route('/communication-costs/')
def communication_costs():
    return render_template(
        'datatable.html',
        slug='communication-costs',
        title='Communication costs',
        dates=utils.date_ranges(),
        columns=constants.table_columns['communication-costs']
    )

@app.route('/reports/<form_type>/')
def reports(form_type):
    if form_type.lower() not in ['presidential', 'house-senate', 'pac-party', 'ie-only']:
        abort(404)
    if form_type.lower() == 'presidential':
        title = 'Presidential committee reports'
    if form_type.lower() == 'house-senate':
        title = 'House and Senate committee reports'
    if form_type.lower() == 'pac-party':
        title = 'PAC and party committee reports'
    if form_type.lower() == 'ie-only':
        title = 'Independent expenditure-only committee reports'
    context = OrderedDict([('form_type', form_type.lower())])
    return render_template(
        'datatable.html',
        slug='reports',
        title=title,
        table_context=context,
        dates=utils.date_ranges(),
        columns=constants.table_columns['reports-' + form_type.lower()]
    )

@app.route('/elections/')
def election_lookup():
    return render_template('election-lookup.html')

@app.route('/elections/<office>/<int:cycle>/')
@app.route('/elections/<office>/<state>/<int:cycle>/')
@app.route('/elections/<office>/<state>/<district>/<int:cycle>/')
def elections(office, cycle, state=None, district=None):
    if office.lower() not in ['president', 'senate', 'house']:
        abort(404)
    if state and state.upper() not in constants.states:
        abort(404)
    cycles = utils.get_cycles()
    if office.lower() == 'president':
        cycles = [each for each in cycles if each % 4 == 0]
    return render_template(
        'elections.html',
        office=office,
        office_code=office[0],
        cycle=cycle,
        cycles=cycles,
        state=state,
        state_full=constants.states[state.upper()] if state else None,
        district=district,
        title=utils.election_title(cycle, office, state, district),
    )

@app.route('/legal/search/')
@use_kwargs({
    'query': fields.Str(load_from='search'),
    'result_type': fields.Str(load_from='search_type', missing='all'),
})
def legal_search(query, result_type):
    if result_type != 'all':
        # search_type is used for google analytics
        return redirect(url_for(result_type, search=query, search_type=result_type))

    results = {}

    # Only hit the API if there's an actual query
    if query:
        results = api_caller.load_legal_search_results(query, result_type, limit=3)

    return views.render_legal_search_results(results, query, result_type)

def legal_doc_search(query, result_type, **kwargs):
    """Legal search for a specific document type."""
    results = {}

    # Only hit the API if there's an actual query
    if query:
        results = api_caller.load_legal_search_results(query, result_type, **kwargs)

    return views.render_legal_doc_search_results(results, query, result_type)

@app.route('/legal/advisory-opinions/')
def advisory_opinions_landing():
    return render_template('legal-advisory-opinions-landing.html',
        result_type='advisory_opinions',
        display_name='advisory opinions')

@app.route('/legal/statutes/')
def statutes_landing():
    return render_template('legal-statutes-landing.html',
        result_type='statutes',
        display_name='statutes')

@app.route('/legal/search/advisory-opinions/')
@use_kwargs({
    'query': fields.Str(load_from='search'),
    'offset': fields.Int(missing=0),
})
def advisory_opinions(query, offset):
    return legal_doc_search(query, 'advisory_opinions', offset=offset)

@app.route('/legal/search/statutes/')
@use_kwargs({
    'query': fields.Str(load_from='search'),
    'offset': fields.Int(missing=0),
})
def statutes(query, offset):
    return legal_doc_search(query, 'statutes', offset=offset)

@app.route('/legal/search/enforcement-matters/')
@use_kwargs({
    'query': fields.Str(load_from='search'),
    'offset': fields.Int(missing=0),
})
def murs(query, offset):
    return legal_doc_search(query, 'murs', offset=offset)

# TODO migrating from /legal/regulations -> /legal/search/regulations, eventually there will be a regulations landing page
@app.route('/legal/regulations/')
def regulations_landing(*args, **kwargs):
    return redirect(url_for('regulations', *args, **kwargs))

@app.route('/legal/search/regulations/')
@use_kwargs({
    'query': fields.Str(load_from='search'),
    'offset': fields.Int(missing=0),
})
def regulations(query, offset):
    return legal_doc_search(query, 'regulations', offset=offset)

@app.route('/legal/advisory-opinions/<ao_no>/')
def advisory_opinion_page(ao_no):
    advisory_opinion = api_caller.load_legal_advisory_opinion(ao_no)

    if not advisory_opinion:
        abort(404)

    return views.render_legal_advisory_opinion(advisory_opinion)

@app.route('/legal/matter-under-review/<mur_no>/')
def mur_page(mur_no):
    mur = api_caller.load_legal_mur(mur_no)

    if not mur:
        abort(404)

    return views.render_legal_mur(mur)
