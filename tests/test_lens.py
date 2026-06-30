"""
WealthLens — unexplained-wealth reconciliation behaviour.

The gap (in whole USD) drives the verdict and the bounty share, and consensus is
judged on the order-of-magnitude bucket as much as the verdict band.
"""

import json
from pathlib import Path

LENS = str(Path(__file__).resolve().parents[1] / "backend" / "asset-match.py")

DECLARATION = "Declared: one apartment, a modest salary, and a small savings account"
RECORD = "Registry shows three apartments, two companies, and a large on-chain wallet"


def reconciled(gap, **sources):
    flags = {"property": False, "corporate": False, "onchain": False,
             "court_tax": False, "lifestyle": False}
    flags.update(sources)
    return json.dumps({
        "discrepancy_units": gap,
        "sources": flags,
        "rationale": "the registry, corporate filings and on-chain holdings concur on the gap",
    })


def fund(vm, lens, amount, funder):
    vm.sender = funder
    vm.value = amount
    lens.fund_pool()
    vm.value = 0


def file_and_reconcile(vm, lens, reporter, gap, **sources):
    vm.sender = reporter
    lens.report_subject("Deputy Minister", DECLARATION, RECORD)
    vm.mock_llm(r"public-integrity analyst", reconciled(gap, **sources))
    lens.reconcile(0)


def test_a_matching_declaration_raises_no_flag(direct_vm, deploy, direct_alice):
    lens = deploy(LENS)
    file_and_reconcile(direct_vm, lens, direct_alice, 10_000, property=True)
    lens.rule(0)
    assert lens.get_verdict(0) == "CONSISTENT"
    with direct_vm.expect_revert("consistent"):
        lens.award_bounty(0)


def test_a_moderate_gap_pays_a_partial_bounty(direct_vm, deploy, direct_alice, direct_bob):
    lens = deploy(LENS)
    fund(direct_vm, lens, 5000, direct_bob)
    file_and_reconcile(direct_vm, lens, direct_alice, 100_000, property=True, corporate=True)
    lens.rule(0)
    assert lens.get_verdict(0) == "DISCREPANCY"

    lens.award_bounty(0)
    # DISCREPANCY -> 40% of the 5000 pool.
    assert lens.get_pool_balance() == "3000||2000"
    assert int(lens.get_case(0).bounty_paid) == 2000


def test_a_gross_gap_pays_the_full_band(direct_vm, deploy, direct_alice, direct_bob):
    lens = deploy(LENS)
    fund(direct_vm, lens, 5000, direct_bob)
    file_and_reconcile(direct_vm, lens, direct_alice, 500_000,
                       property=True, corporate=True, onchain=True)
    lens.rule(0)
    assert lens.get_verdict(0) == "UNEXPLAINED_WEALTH"

    lens.award_bounty(0)
    assert lens.get_pool_balance() == "0||5000"
    assert lens.get_stats().split("||")[-1] == "1"  # unexplained tally


def test_the_gap_is_bucketed_by_magnitude(direct_vm, deploy, direct_alice):
    lens = deploy(LENS)
    file_and_reconcile(direct_vm, lens, direct_alice, 500_000, onchain=True)
    # 500_000 has six digits -> base-10 bucket 5.
    assert lens.get_gap(0) == "gap=500000|magnitude=5"


def test_concurring_sources_are_counted(direct_vm, deploy, direct_alice):
    lens = deploy(LENS)
    file_and_reconcile(direct_vm, lens, direct_alice, 300_000,
                       property=True, onchain=True, court_tax=True)
    assert lens.get_concurrence(0).endswith("|count=3")


def test_the_lens_rejects_thin_reports(direct_vm, deploy, direct_alice):
    lens = deploy(LENS)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("subject"):
        lens.report_subject("", DECLARATION, RECORD)
    with direct_vm.expect_revert("too short"):
        lens.report_subject("Deputy Minister", "short", RECORD)


def test_validators_agree_within_a_band(direct_vm, deploy, direct_alice):
    lens = deploy(LENS)
    file_and_reconcile(direct_vm, lens, direct_alice, 500_000, property=True, onchain=True)
    assert direct_vm.run_validator() is True

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"public-integrity analyst", reconciled(10_000))  # falls to CONSISTENT
    assert direct_vm.run_validator() is False


def test_the_band_table_is_published(direct_vm, deploy):
    lens = deploy(LENS)
    table = lens.describe_bands()
    assert "consistent_ceiling=25000" in table
    assert "unexplained_floor=250000" in table
