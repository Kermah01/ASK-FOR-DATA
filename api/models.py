from django.db import models
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet


class UserProfile(models.Model):
    """Profil utilisateur avec clé API Gemini et suivi de quota"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    encrypted_api_key = models.TextField(blank=True, null=True)
    has_own_key = models.BooleanField(default=False)
    queries_today = models.IntegerField(default=0)
    last_query_date = models.DateField(null=True, blank=True)
    total_queries = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} ({'clé perso' if self.has_own_key else 'clé serveur'})"

    def set_api_key(self, api_key: str):
        """Chiffre et stocke la clé API"""
        f = Fernet(settings.FERNET_KEY.encode())
        self.encrypted_api_key = f.encrypt(api_key.encode()).decode()
        self.has_own_key = True
        self.save()

    def get_api_key(self) -> str:
        """Déchiffre et retourne la clé API, ou la clé serveur par défaut"""
        if self.has_own_key and self.encrypted_api_key:
            try:
                f = Fernet(settings.FERNET_KEY.encode())
                return f.decrypt(self.encrypted_api_key.encode()).decode()
            except Exception:
                return settings.GEMINI_API_KEY
        return settings.GEMINI_API_KEY

    def clear_api_key(self):
        """Supprime la clé API personnelle"""
        self.encrypted_api_key = None
        self.has_own_key = False
        self.save()

    def check_and_increment_quota(self) -> dict:
        """
        Vérifie le quota et incrémente le compteur.
        Retourne {'allowed': bool, 'remaining': int, 'needs_key': bool}
        """
        today = timezone.now().date()

        # Reset quotidien
        if self.last_query_date != today:
            self.queries_today = 0
            self.last_query_date = today

        # Si clé perso → pas de limite côté serveur
        if self.has_own_key:
            self.queries_today += 1
            self.total_queries += 1
            self.save()
            return {'allowed': True, 'remaining': -1, 'needs_key': False}

        # Sinon, quota limité avec la clé serveur
        limit = settings.FREE_QUERIES_PER_DAY
        if self.queries_today >= limit:
            return {'allowed': False, 'remaining': 0, 'needs_key': True}

        self.queries_today += 1
        self.total_queries += 1
        self.save()
        return {
            'allowed': True,
            'remaining': limit - self.queries_today,
            'needs_key': False
        }


class Conversation(models.Model):
    """Conversation persistante pour le chat IA"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')
    title = models.CharField(max_length=200, default='Nouvelle conversation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.email}: {self.title[:50]}"


class Message(models.Model):
    """Message dans une conversation"""
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    data_context = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}..."


class QueryCache(models.Model):
    """Cache des réponses Gemini pour éviter les appels redondants"""
    query_hash = models.CharField(max_length=64, unique=True, db_index=True)
    query_text = models.TextField()
    response_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    hit_count = models.IntegerField(default=0)
    positive_feedback = models.IntegerField(default=0)
    negative_feedback = models.IntegerField(default=0)
    invalidated = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Cache: {self.query_text[:50]}..."

    @property
    def is_trusted(self):
        """Cache entry is trusted if not invalidated and positive >= negative feedback"""
        if self.invalidated:
            return False
        if self.negative_feedback > 0 and self.negative_feedback >= self.positive_feedback:
            return False
        return True
