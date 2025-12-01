# 학생 추가 스크립트 (오류 확인용)
import sys
import traceback

try:
    sys.path.append('C:/Dittonweb')
    from backend.database import SessionLocal
    from backend.models import Student
    
    db = SessionLocal()
    
    students = [
        {'name': '김철수', 'seat_number': 'A35', 'student_type': '재수생', 'phone': '010-1111-2222', 'gender': '남', 'status': '재원'},
        {'name': '이영희', 'seat_number': 'A26', 'student_type': 'N수생', 'phone': '010-3333-4444', 'gender': '여', 'status': '재원'},
        {'name': '박민수', 'seat_number': 'A18', 'student_type': '재수생', 'phone': '010-5555-6666', 'gender': '남', 'status': '재원'},
        {'name': '최지은', 'seat_number': 'B22', 'student_type': '재수생', 'phone': '010-7777-8888', 'gender': '여', 'status': '재원'},
        {'name': '정우진', 'seat_number': 'B18', 'student_type': 'N수생', 'phone': '010-9999-0000', 'gender': '남', 'status': '재원'},
        {'name': '강서연', 'seat_number': 'B10', 'student_type': '재수생', 'phone': '010-1234-5678', 'gender': '여', 'status': '재원'}
    ]
    
    count = 0
    for s in students:
        existing = db.query(Student).filter(Student.seat_number == s['seat_number']).first()
        if not existing:
            new_student = Student(**s)
            db.add(new_student)
            count += 1
            print(f"Added {s['name']} ({s['seat_number']})")
        else:
            print(f"Skipped {s['name']} ({s['seat_number']}) - Already exists")
            
    db.commit()
    print(f"\n✅ 학생 {count}명 추가 완료!")
    db.close()

except Exception as e:
    print(f"\n❌ 오류 발생: {e}")
    traceback.print_exc()
