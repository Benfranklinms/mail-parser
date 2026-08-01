"""
Tests for the hybrid extraction pipeline.

Tests cover:
- Pre-filter (positive and negative examples)
- Regex extraction (salary, dates, links)
- Merge logic (regex + LLM combination)
- Full pipeline end-to-end
"""

import pytest
from unittest.mock import patch, MagicMock
from app.services.extraction import (
    pre_filter,
    regex_extract,
    merge_results,
    _extract_salary,
    _extract_date,
    _extract_links,
    run_extraction_pipeline,
)
from app.services.llm_providers import extract_with_llm


# =============================================================================
# Pre-filter tests
# =============================================================================


class TestPreFilter:
    """Tests for the pre-filter stage."""

    def test_placement_email_passes(self):
        assert pre_filter(
            subject="Placement Opportunity at TCS",
            sender="placement@college.edu",
            body="Dear students, TCS is hiring for the role of Software Developer."
        ) is True

    def test_internship_email_passes(self):
        assert pre_filter(
            subject="Internship Opportunity - Google",
            sender="placement@college.edu",
            body="Google is offering summer internship positions."
        ) is True

    def test_recruitment_drive_passes(self):
        assert pre_filter(
            subject="Campus Drive - Infosys",
            sender="placement@college.edu",
            body="Infosys recruitment drive for 2025 batch. CTC: 6 LPA. Stipend during training."
        ) is True

    def test_body_keywords_pass(self):
        """Email with placement keywords in body but not subject."""
        assert pre_filter(
            subject="Important Update",
            sender="placement@college.edu",
            body="Please register for the placement drive by Wipro. Last date to apply: 15/08/2025."
        ) is True

    def test_newsletter_filtered(self):
        assert pre_filter(
            subject="Weekly Newsletter - College Update",
            sender="newsletter@college.edu",
            body="This is our weekly newsletter. Unsubscribe if you don't want to receive these."
        ) is False

    def test_exam_schedule_filtered(self):
        assert pre_filter(
            subject="Exam Schedule - Semester 6",
            sender="exam@college.edu",
            body="The exam schedule for semester 6 has been released. Please check the attendance portal."
        ) is False

    def test_empty_content_filtered(self):
        assert pre_filter(subject="", sender="", body="") is False

    def test_general_announcement_no_keywords(self):
        assert pre_filter(
            subject="Holiday Notice",
            sender="admin@college.edu",
            body="The college will remain closed on account of Independence Day."
        ) is False


# =============================================================================
# Salary extraction tests
# =============================================================================


class TestSalaryExtraction:
    """Tests for salary/stipend regex extraction."""

    def test_lpa_format(self):
        result = _extract_salary("The CTC offered is 6 LPA for selected candidates.")
        assert result is not None
        assert "6" in result

    def test_lpa_with_decimal(self):
        result = _extract_salary("Package: 6.5 LPA")
        assert result is not None
        assert "6.5" in result

    def test_lakhs_format(self):
        result = _extract_salary("Salary: 8 lakhs per annum")
        assert result is not None
        assert "8" in result

    def test_stipend_per_month(self):
        result = _extract_salary("Stipend: ₹25,000/month during internship period")
        assert result is not None
        assert "25,000" in result

    def test_stipend_simple(self):
        result = _extract_salary("Stipend: ₹15000")
        assert result is not None
        assert "15000" in result

    def test_ctc_with_rupee_symbol(self):
        result = _extract_salary("CTC: ₹8 LPA + benefits")
        assert result is not None

    def test_unpaid(self):
        result = _extract_salary("This is an unpaid internship opportunity.")
        assert result is not None
        assert "unpaid" in result.lower()

    def test_no_salary_info(self):
        result = _extract_salary("We are looking for talented individuals to join our team.")
        assert result is None


# =============================================================================
# Date extraction tests
# =============================================================================


class TestDateExtraction:
    """Tests for deadline date regex extraction."""

    def test_last_date_dd_mm_yyyy(self):
        result = _extract_date("Last date to register: 25/12/2025")
        assert result is not None
        assert "25/12/2025" in result

    def test_deadline_with_dash(self):
        result = _extract_date("Deadline: 15-08-2025")
        assert result is not None
        assert "15-08-2025" in result

    def test_last_date_month_name(self):
        result = _extract_date("Last date: 25 December 2025")
        assert result is not None
        assert "25 December 2025" in result

    def test_register_by_date(self):
        result = _extract_date("Register by 10th Jan 2026")
        assert result is not None
        assert "10th Jan 2026" in result

    def test_apply_before_date(self):
        result = _extract_date("Apply before 5 March")
        assert result is not None

    def test_no_date_info(self):
        result = _extract_date("Please apply at your earliest convenience.")
        assert result is None


# =============================================================================
# Link extraction tests
# =============================================================================


class TestLinkExtraction:
    """Tests for registration link extraction."""

    def test_google_form_link(self):
        links = _extract_links("Register here: https://forms.gle/abc123xyz")
        assert len(links) >= 1
        assert any("forms.gle" in link for link in links)

    def test_google_docs_form(self):
        links = _extract_links(
            "Fill out the form: https://docs.google.com/forms/d/e/1FAIpQLSe/viewform"
        )
        assert len(links) >= 1
        assert any("docs.google.com/forms" in link for link in links)

    def test_multiple_links(self):
        body = """
        Registration: https://forms.gle/abc123
        Job Description: https://careers.tcs.com/job/12345
        More info: https://www.company.com/apply
        """
        links = _extract_links(body)
        assert len(links) >= 3

    def test_ats_domains(self):
        body = "Apply at https://jobs.greenhouse.io/company/12345"
        links = _extract_links(body)
        assert len(links) >= 1
        assert any("greenhouse.io" in link for link in links)

    def test_filters_social_media(self):
        body = """
        Apply here: https://forms.gle/abc123
        Follow us: https://www.facebook.com/company
        Twitter: https://twitter.com/company
        """
        links = _extract_links(body)
        # Should include the form link but not social media
        assert any("forms.gle" in link for link in links)
        assert not any("facebook.com" in link for link in links)
        assert not any("twitter.com" in link for link in links)

    def test_no_links(self):
        links = _extract_links("Please visit the placement office for more details.")
        assert links == []

    def test_deduplicates_links(self):
        body = """
        Link: https://forms.gle/abc123
        Same link: https://forms.gle/abc123
        """
        links = _extract_links(body)
        assert links.count("https://forms.gle/abc123") == 1


# =============================================================================
# Merge results tests
# =============================================================================


class TestMergeResults:
    """Tests for merging regex and LLM results."""

    def test_hybrid_merge(self):
        regex_result = {
            "company": None,
            "role": None,
            "role_type": None,
            "salary_or_stipend": "CTC: 6 LPA",
            "bond": None,
            "last_date": "25/12/2025",
            "register_links": ["https://forms.gle/abc"],
        }

        llm_result = {
            "company": "TCS",
            "role": "Software Developer",
            "role_type": "full-time",
            "salary_or_stipend": "6 LPA",
            "bond": "2 years",
            "last_date": "December 25, 2025",
            "register_links": ["https://forms.gle/abc", "https://careers.tcs.com/apply"],
        }

        merged = merge_results(regex_result, llm_result)

        # LLM preferred for company/role/role_type/bond
        assert merged["company"] == "TCS"
        assert merged["role"] == "Software Developer"
        assert merged["role_type"] == "full-time"
        assert merged["bond"] == "2 years"

        # Regex preferred for salary/date
        assert merged["salary_or_stipend"] == "CTC: 6 LPA"
        assert merged["last_date"] == "25/12/2025"

        # Links merged and deduplicated
        assert "https://forms.gle/abc" in merged["register_links"]
        assert "https://careers.tcs.com/apply" in merged["register_links"]

        # Should be hybrid since both contributed
        assert merged["extraction_method"] == "hybrid"

    def test_regex_only(self):
        regex_result = {
            "company": None,
            "role": None,
            "role_type": None,
            "salary_or_stipend": "₹25,000/month",
            "bond": None,
            "last_date": "15/01/2026",
            "register_links": ["https://forms.gle/xyz"],
        }

        llm_result = {
            "company": None,
            "role": None,
            "role_type": None,
            "salary_or_stipend": None,
            "bond": None,
            "last_date": None,
            "register_links": [],
        }

        merged = merge_results(regex_result, llm_result)
        assert merged["extraction_method"] == "regex"

    def test_llm_only(self):
        regex_result = {
            "company": None,
            "role": None,
            "role_type": None,
            "salary_or_stipend": None,
            "bond": None,
            "last_date": None,
            "register_links": [],
        }

        llm_result = {
            "company": "Google",
            "role": "SDE Intern",
            "role_type": "internship",
            "salary_or_stipend": "₹80,000/month",
            "bond": None,
            "last_date": "January 15, 2026",
            "register_links": ["https://careers.google.com/apply"],
        }

        merged = merge_results(regex_result, llm_result)
        assert merged["extraction_method"] == "llm"
        assert merged["company"] == "Google"

    def test_regex_preferred_for_salary(self):
        """When both have salary, regex should win."""
        regex_result = {
            "company": None, "role": None, "role_type": None,
            "salary_or_stipend": "CTC: ₹8 LPA",
            "bond": None, "last_date": None, "register_links": [],
        }

        llm_result = {
            "company": "Infosys", "role": "Developer", "role_type": "full-time",
            "salary_or_stipend": "8 LPA",
            "bond": None, "last_date": None, "register_links": [],
        }

        merged = merge_results(regex_result, llm_result)
        assert merged["salary_or_stipend"] == "CTC: ₹8 LPA"  # Regex wins

    def test_empty_results(self):
        """Both empty should produce empty result."""
        empty = {
            "company": None, "role": None, "role_type": None,
            "salary_or_stipend": None, "bond": None,
            "last_date": None, "register_links": [],
        }

        merged = merge_results(empty, empty)
        assert merged["company"] is None
        assert merged["register_links"] == []


# =============================================================================
# Full regex_extract integration tests
# =============================================================================


class TestRegexExtractIntegration:
    """Integration tests with realistic email bodies."""

    def test_typical_placement_email(self):
        body = """
        Dear Students,

        We are pleased to inform you that TCS (Tata Consultancy Services)
        is conducting a campus drive for the 2025 batch.

        Role: Software Developer
        CTC: 7 LPA
        Bond: 2 years service agreement

        Eligible Branches: CS, IT, ECE, EEE
        CGPA Criteria: 6.0 and above

        Last date to register: 25/08/2025

        Registration Link: https://forms.gle/tcsPlacement2025
        Job Description: https://careers.tcs.com/campus/jd-12345

        Regards,
        Placement Cell
        """

        result = regex_extract(body)

        assert result["salary_or_stipend"] is not None
        assert "7" in result["salary_or_stipend"]

        assert result["last_date"] is not None
        assert "25/08/2025" in result["last_date"]

        assert len(result["register_links"]) >= 2
        assert any("forms.gle" in link for link in result["register_links"])
        assert any("careers.tcs.com" in link for link in result["register_links"])

    def test_internship_email_with_stipend(self):
        body = """
        Internship Opportunity at Zomato

        Stipend: ₹25,000/month
        Duration: 6 months

        Apply before 10th January 2026

        Apply here: https://internshala.com/internship/detail/12345

        Team HR, Zomato
        """

        result = regex_extract(body, subject="Internship Opportunity at Zomato")

        assert result["salary_or_stipend"] is not None
        assert "25,000" in result["salary_or_stipend"]

        assert len(result["register_links"]) >= 1
        assert any("internshala.com" in link for link in result["register_links"])


# =============================================================================
# OpenRouter extraction tests
# =============================================================================


class TestOpenRouterExtraction:
    """Tests for the OpenRouter LLM extraction stage."""

    @patch("requests.post")
    def test_openrouter_extract_success(self, mock_post):
        # Mock successful OpenRouter API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": '{"company": "Stripe", "role": "Backend Engineer", "role_type": "full-time", "salary_or_stipend": "12 LPA", "bond": "none", "last_date": null, "register_links": []}'
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        # Execute extraction
        result = extract_with_llm(
            email_body="Stripe is hiring Backend Engineers.",
            api_key="mock-openrouter-key",
            provider="openrouter",
            subject="Job opening at Stripe",
            model_id="meta-llama/llama-3.1-8b-instruct:free",
        )

        # Verify output
        assert result["company"] == "Stripe"
        assert result["role"] == "Backend Engineer"
        assert result["role_type"] == "full-time"

        # Verify POST payload and model parameter
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "https://openrouter.ai/api/v1/chat/completions"
        assert kwargs["json"]["model"] == "meta-llama/llama-3.1-8b-instruct:free"
        assert kwargs["headers"]["Authorization"] == "Bearer mock-openrouter-key"

    @patch("requests.post")
    def test_run_pipeline_propagates_model_id(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": '{"company": "Google", "role": "Intern", "role_type": "internship", "salary_or_stipend": null, "bond": null, "last_date": null, "register_links": []}'
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        # Execute the pipeline (which filters, matches regex, and calls LLM)
        result = run_extraction_pipeline(
            email_body="Google is hiring interns. Apply now.",
            subject="Google Internship",
            sender="recruitment@google.com",
            api_key="mock-key",
            provider="openrouter",
            model_id="google/gemma-2-9b-it:free",
        )

        assert result is not None
        assert result["company"] == "Google"
        assert result["role"] == "Intern"

        # Verify model_id was forwarded
        kwargs = mock_post.call_args[1]
        assert kwargs["json"]["model"] == "google/gemma-2-9b-it:free"

