from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session authentication without CSRF enforcement for API endpoints"""
    def enforce_csrf(self, request):
        return  # Skip CSRF check
