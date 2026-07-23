import pytest
from errors import MethodNotAllowedError, NotFoundError
from router import Router


class TestRouterDispatch:
    def test_dispatches_to_the_matching_method_and_static_path(self):
        router = Router()
        router.add("GET", "/projects", lambda **kwargs: "list")
        assert router.dispatch("GET", "/projects") == "list"

    def test_is_case_insensitive_on_the_http_method(self):
        router = Router()
        router.add("GET", "/projects", lambda **kwargs: "list")
        assert router.dispatch("get", "/projects") == "list"

    def test_extracts_a_single_path_param(self):
        router = Router()
        router.add("GET", "/projects/{id}", lambda id, **kwargs: id)
        assert router.dispatch("GET", "/projects/abc-123") == "abc-123"

    def test_extracts_multiple_path_params(self):
        router = Router()
        router.add(
            "GET",
            "/projects/{project_id}/deliverables/{id}",
            lambda project_id, id, **kwargs: f"{project_id}:{id}",
        )
        assert router.dispatch("GET", "/projects/p1/deliverables/d1") == "p1:d1"

    def test_forwards_extra_keyword_arguments_alongside_path_params(self):
        router = Router()
        router.add("GET", "/projects/{id}", lambda id, headers, **kwargs: (id, headers))
        result = router.dispatch("GET", "/projects/p1", headers={"authorization": "Bearer x"})
        assert result == ("p1", {"authorization": "Bearer x"})

    def test_a_path_param_does_not_match_across_a_slash(self):
        router = Router()
        router.add("GET", "/projects/{id}", lambda id, **kwargs: id)
        with pytest.raises(NotFoundError):
            router.dispatch("GET", "/projects/p1/deliverables")

    def test_raises_not_found_when_no_route_matches_the_path_at_all(self):
        router = Router()
        router.add("GET", "/projects", lambda **kwargs: "list")
        with pytest.raises(NotFoundError):
            router.dispatch("GET", "/no-such-path")

    def test_raises_method_not_allowed_when_the_path_matches_but_the_method_does_not(self):
        router = Router()
        router.add("GET", "/projects", lambda **kwargs: "list")
        with pytest.raises(MethodNotAllowedError):
            router.dispatch("DELETE", "/projects")

    def test_first_registered_route_wins_when_two_patterns_could_match(self):
        router = Router()
        router.add("GET", "/projects/summary", lambda **kwargs: "summary")
        router.add("GET", "/projects/{id}", lambda id, **kwargs: id)
        assert router.dispatch("GET", "/projects/summary") == "summary"

    def test_add_returns_the_router_for_chaining(self):
        router = Router()
        result = router.add("GET", "/projects", lambda **kwargs: "list")
        assert result is router
