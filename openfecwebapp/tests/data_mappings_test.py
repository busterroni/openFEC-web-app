from flask import Flask
from flask.ext.testing import TestCase
from mock import patch
from openfecwebapp.data_mappings import *

class TestDataMappings(TestCase):

    def create_app(self):
        app = Flask(__name__)
        app.config['TESTING'] = True

        @app.route('/candidates')
        def candidates():
            pass

        return app

    def setUp(self):
        self.candidate = {
            'name': {
                'full_name': 'Person McPersonson'
            },
            'elections': [{
                'party_affiliation': 'Cool People',
                'state': 'TN',
                'election_year': '2012',
                'office_sought_full': 'Supreme Ruler',
                'district': '11',
                'incumbent_challenge_full': 'challenger',
                'primary_committee': {
                    'id': 'D1234',
                    'committee_id': 'D1234',
                    'committee_name': 'Friends of McPersonson',
                    'designation': 'Authorized',
                    'designation_code': 'PC' 
                },
                'authorized_committees': {}
            }],
            'mailing_addresses': [{
                'state': 'CA'
            }],
            'candidate_id': 'A12345',
            'pagination': {
                'per_page': '20',
                'page': '2',
                'pages': '5',
                'count': '100'
            }
        }

        self.committee = {
            'description': {
                'name': 'Friends of McPersonson',
                'organization_type': 'Secret Club'
            },
            'treasurer': {
                'name_full': 'Money McMaster'
            },
            'address': {
                'street_1': '123 Boulevard St.',
                'street_2': '#595',
                'city': 'Placetown',
                'state': 'KY',
                'zip': '23456'
            },
            'status': {
                'type_full': 'Partay',
                'designation': 'Very Authorized'
            },
            'committee_id': 'B7890'
        }

        self.totals = {
            'results': [{
                'committee_id': 'D1234',
                'reports': [{
                    'cash_on_hand_end_period': 123.34,
                    'debts_owed_by_committee': 45678.90,
                    'report_year': 2010,
                    'election_cycle': 2010,
                    'report_type_full': 'End Report'
                }],
                'totals': [{
                    'receipts': 231.45,
                    'disbursements': 3453.54
                }]
            }]
        }

        self.early_ac = [
            {
                'id': 'D1234',
                'committee_id': 'D1234',
                'committee_name': 'Friends of McPersonson',
                'designation': 'Authorized',
                'designation_code': 'A' 

            }
        ]

        self.late_ac = {
            'D1234': {
                'id': 'D1234',
                'committee_id': 'D1234',
                'committee_name': 'Friends of McPersonson',
                'designation': 'Authorized',
                'designation_code': 'A' 
            }
        }


    def test_generate_pagination_values(self):
        params = {}
        url = 'http://yay.com'
        data_type = 'candidates'

        with self.app.app_context():
            vals = generate_pagination_values(self.candidate, params,
                url, data_type)

        self.assertEqual('100', vals['results_count'])
        self.assertEqual(2, vals['page'])
        self.assertEqual(20, vals['per_page'])
        self.assertEqual(21, vals['current_results_start'])
        self.assertEqual(40, vals['current_results_end'])
        self.assertTrue(vals['results_range'])
        self.assertTrue(vals['pagination_links'])
        self.assertEqual('/candidates?page=3', vals['next_url'])
        self.assertEqual('/candidates?page=1', vals['prev_url'])

    @patch('openfecwebapp.data_mappings.load_totals')
    def test_add_committee_data(self, mock_totals):
        mock_totals.return_value = self.totals
        candidate = self.candidate
        candidate['authorized_committees'] = self.late_ac

        vals = add_committee_data(candidate, 'candidate')
        c = vals['authorized_committees']['D1234']
        self.assertEqual('$231.45', c['total_receipts'])
        self.assertEqual('$3,453.54', c['total_disbursements'])
        self.assertEqual('$123.34', c['total_cash'])
        self.assertEqual('$45,678.90', c['total_debt'])
        self.assertEqual('2010', c['report_year'])
        self.assertEqual('2009 - 2010', c['years_totals'])
        self.assertEqual('End Report', c['report_desc'])




if __name__ == '__main__':
    unittest.main()
