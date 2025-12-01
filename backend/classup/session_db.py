"""ClassUp 세션 DB 저장/로드 헬퍼 (배포 영속성)

컨테이너 재시작 시에도 세션을 유지하기 위해 PostgreSQL에 저장합니다.
파일 기반 세션은 Playwright가 직접 사용하고,
DB는 백업/복원용으로 사용합니다.
"""
import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# 세션 파일 경로 (scraper.py와 동일)
SESSION_FILE = Path(__file__).parent / "classup_session.json"


def save_session_to_db(session_key: str = "default"):
    """세션 파일을 DB에 백업 저장"""
    try:
        if not SESSION_FILE.exists():
            logger.warning("세션 파일이 없어서 DB에 저장할 수 없습니다.")
            return False

        # 세션 파일 읽기
        with open(SESSION_FILE, 'r', encoding='utf-8') as f:
            session_data = f.read()

        # DB에 저장 (지연 임포트로 순환 참조 방지)
        from database import SessionLocal
        import models

        db = SessionLocal()
        try:
            # 기존 세션 확인
            existing = db.query(models.ClassUpSession).filter(
                models.ClassUpSession.session_key == session_key
            ).first()

            if existing:
                # 업데이트
                existing.session_data = session_data
                existing.updated_at = datetime.utcnow()
                logger.info(f"세션 DB 업데이트 완료: {session_key}")
            else:
                # 새로 생성
                new_session = models.ClassUpSession(
                    session_key=session_key,
                    session_data=session_data
                )
                db.add(new_session)
                logger.info(f"세션 DB 저장 완료: {session_key}")

            db.commit()
            return True
        finally:
            db.close()

    except Exception as e:
        logger.error(f"세션 DB 저장 실패: {e}")
        return False


def load_session_from_db(session_key: str = "default") -> bool:
    """DB에서 세션을 읽어 파일로 복원"""
    try:
        from database import SessionLocal
        import models

        db = SessionLocal()
        try:
            session = db.query(models.ClassUpSession).filter(
                models.ClassUpSession.session_key == session_key
            ).first()

            if not session:
                logger.info(f"DB에 저장된 세션 없음: {session_key}")
                return False

            # 파일로 복원
            with open(SESSION_FILE, 'w', encoding='utf-8') as f:
                f.write(session.session_data)

            logger.info(f"세션 DB에서 파일로 복원 완료: {session_key}")
            return True
        finally:
            db.close()

    except Exception as e:
        logger.error(f"세션 DB 로드 실패: {e}")
        return False


def delete_session_from_db(session_key: str = "default") -> bool:
    """DB에서 세션 삭제"""
    try:
        from database import SessionLocal
        import models

        db = SessionLocal()
        try:
            deleted = db.query(models.ClassUpSession).filter(
                models.ClassUpSession.session_key == session_key
            ).delete()
            db.commit()

            if deleted:
                logger.info(f"세션 DB 삭제 완료: {session_key}")
            return deleted > 0
        finally:
            db.close()

    except Exception as e:
        logger.error(f"세션 DB 삭제 실패: {e}")
        return False


def has_session_in_db(session_key: str = "default") -> bool:
    """DB에 세션이 있는지 확인"""
    try:
        from database import SessionLocal
        import models

        db = SessionLocal()
        try:
            exists = db.query(models.ClassUpSession).filter(
                models.ClassUpSession.session_key == session_key
            ).first() is not None
            return exists
        finally:
            db.close()

    except Exception as e:
        logger.error(f"세션 DB 확인 실패: {e}")
        return False


def ensure_session_file():
    """세션 파일이 없으면 DB에서 복원 시도"""
    if SESSION_FILE.exists():
        return True

    logger.info("세션 파일이 없습니다. DB에서 복원 시도...")
    return load_session_from_db()
