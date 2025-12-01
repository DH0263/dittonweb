"""
학생 조회 서비스
"""
from typing import Optional, List
from sqlalchemy.orm import joinedload

from bot.core.database import DatabaseContext, Student
from bot.utils.validators import detect_input_type, InputType, normalize_seat_number


class StudentService:
    """학생 정보 조회 서비스"""

    @staticmethod
    def get_by_seat_number(seat_number: str) -> Optional[Student]:
        """
        좌석번호로 학생 조회

        Args:
            seat_number: 좌석번호 (예: A1, B15)

        Returns:
            Student 객체 또는 None
        """
        seat = normalize_seat_number(seat_number)

        with DatabaseContext() as db:
            student = db.query(Student).options(
                joinedload(Student.penalties)
            ).filter(
                Student.seat_number == seat,
                Student.status == "재원"
            ).first()

            if student:
                # 세션 종료 전에 필요한 데이터 로드
                _ = student.penalties  # Force load
                db.expunge(student)

            return student

    @staticmethod
    def search_by_name(name: str) -> List[Student]:
        """
        이름으로 학생 검색 (부분 일치)

        Args:
            name: 학생 이름 (부분 일치 검색)

        Returns:
            Student 객체 리스트
        """
        with DatabaseContext() as db:
            students = db.query(Student).options(
                joinedload(Student.penalties)
            ).filter(
                Student.name.contains(name),
                Student.status == "재원"
            ).all()

            # 세션 종료 전에 객체 분리
            for student in students:
                _ = student.penalties  # Force load
                db.expunge(student)

            return students

    @staticmethod
    def find_student(query: str) -> Optional[Student]:
        """
        검색어로 학생 찾기 (자동으로 좌석/이름 감지)

        Args:
            query: 검색어 (좌석번호 또는 이름)

        Returns:
            Student 객체 또는 None
        """
        input_type = detect_input_type(query)

        if input_type == InputType.SEAT:
            return StudentService.get_by_seat_number(query)
        else:
            students = StudentService.search_by_name(query)
            if len(students) == 1:
                return students[0]
            elif len(students) > 1:
                # 정확히 일치하는 이름이 있으면 반환
                for student in students:
                    if student.name == query:
                        return student
                # 여러 명이면 첫 번째 반환 (또는 None 반환하고 선택하게 할 수 있음)
                return students[0]
            return None

    @staticmethod
    def get_by_id(student_id: int) -> Optional[Student]:
        """
        ID로 학생 조회

        Args:
            student_id: 학생 ID

        Returns:
            Student 객체 또는 None
        """
        with DatabaseContext() as db:
            student = db.query(Student).options(
                joinedload(Student.penalties),
                joinedload(Student.recurring_outings),
                joinedload(Student.recurring_counseling),
                joinedload(Student.outings),
                joinedload(Student.schedules)
            ).filter(
                Student.id == student_id
            ).first()

            if student:
                # Force load all relationships
                _ = student.penalties
                _ = student.recurring_outings
                _ = student.recurring_counseling
                _ = student.outings
                _ = student.schedules
                db.expunge(student)

            return student
