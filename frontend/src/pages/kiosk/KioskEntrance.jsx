import React, { useState, useEffect } from 'react';

// API URLs
const FINGERPRINT_API = 'http://localhost:5000';
const DITTONWEB_API = 'http://localhost:8000';

function KioskEntrance() {
  const [status, setStatus] = useState('idle'); // idle, scanning, success, error
  const [message, setMessage] = useState('');
  const [studentInfo, setStudentInfo] = useState(null);
  const [actionType, setActionType] = useState('entrance'); // entrance or exit
  const [serverStatus, setServerStatus] = useState({ fingerprint: false, backend: false });

  // 서버 상태 확인
  useEffect(() => {
    checkServers();
    const interval = setInterval(checkServers, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkServers = async () => {
    const fingerprintOk = await checkServer(FINGERPRINT_API);
    const backendOk = await checkServer(`${DITTONWEB_API}/students/`);
    setServerStatus({ fingerprint: fingerprintOk, backend: backendOk });
  };

  const checkServer = async (url) => {
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      return response.ok;
    } catch {
      return false;
    }
  };

  // 지문 인식 → 등원/퇴장 처리
  const handleScan = async (type) => {
    setActionType(type);
    setStatus('scanning');
    setMessage(`지문을 스캔하고 있습니다...`);
    setStudentInfo(null);

    try {
      // 1단계: 지문 인식
      const fingerprintResponse = await fetch(`${FINGERPRINT_API}/fingerprint/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!fingerprintResponse.ok) {
        throw new Error('지문 인식 서버 오류');
      }

      const fingerprintData = await fingerprintResponse.json();

      if (!fingerprintData.success || !fingerprintData.user_id) {
        throw new Error('등록되지 않은 지문입니다');
      }

      const userId = fingerprintData.user_id;

      // 2단계: 학생 정보 조회
      const studentResponse = await fetch(`${DITTONWEB_API}/students/${userId}`);

      if (!studentResponse.ok) {
        throw new Error('학생 정보를 찾을 수 없습니다');
      }

      const student = await studentResponse.json();

      // 3단계: 출석/퇴장 기록
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      let attendanceData;
      let successMessage;

      if (type === 'entrance') {
        // 등원
        attendanceData = {
          student_id: userId,
          date: today,
          status: '자습중',
          check_in_time: timeString,
          notes: '키오스크 지문인식 - 등원'
        };
        successMessage = `${student.name}님, 등원 완료!`;
      } else {
        // 퇴장
        attendanceData = {
          student_id: userId,
          date: today,
          status: '퇴원',
          check_out_time: timeString,
          notes: '키오스크 지문인식 - 퇴장'
        };
        successMessage = `${student.name}님, 안녕히 가세요!`;
      }

      const attendanceResponse = await fetch(`${DITTONWEB_API}/attendance-records/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendanceData)
      });

      if (!attendanceResponse.ok) {
        const errorData = await attendanceResponse.json().catch(() => ({}));
        if (errorData.detail && errorData.detail.includes('이미')) {
          setStatus('success');
          setMessage(`${student.name}님, 이미 ${type === 'entrance' ? '등원' : '퇴장'} 처리되었습니다!`);
          setStudentInfo(student);
          resetAfterDelay();
          return;
        }
        throw new Error('기록 실패');
      }

      // 성공!
      setStatus('success');
      setMessage(successMessage);
      setStudentInfo(student);
      resetAfterDelay();

    } catch (error) {
      setStatus('error');
      setMessage(error.message || '오류가 발생했습니다');
      resetAfterDelay(5000);
    }
  };

  const resetAfterDelay = (delay = 3000) => {
    setTimeout(() => {
      setStatus('idle');
      setMessage('');
      setStudentInfo(null);
    }, delay);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'scanning': return '#3b82f6';
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'scanning': return '🔍';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '🏫';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px'
    }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#111', marginBottom: '8px' }}>
          🏫 디턴 학원 출석 시스템
        </h1>
        <p style={{ fontSize: '24px', color: '#6b7280', fontWeight: '600', marginTop: '16px' }}>
          📍 외부용 키오스크
        </p>
        <p style={{ fontSize: '20px', color: '#9ca3af', marginTop: '8px' }}>
          등원 / 퇴장
        </p>
      </div>

      {/* 서버 상태 표시 */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '32px',
        fontSize: '14px'
      }}>
        <div style={{
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: serverStatus.fingerprint ? '#d1fae5' : '#fee2e2',
          color: serverStatus.fingerprint ? '#065f46' : '#991b1b'
        }}>
          {serverStatus.fingerprint ? '🟢' : '🔴'} 지문인식 서버
        </div>
        <div style={{
          padding: '8px 16px',
          borderRadius: '8px',
          backgroundColor: serverStatus.backend ? '#d1fae5' : '#fee2e2',
          color: serverStatus.backend ? '#065f46' : '#991b1b'
        }}>
          {serverStatus.backend ? '🟢' : '🔴'} 출석 서버
        </div>
      </div>

      {/* 메인 카드 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        padding: '64px',
        width: '100%',
        maxWidth: '700px',
        textAlign: 'center'
      }}>
        {/* 상태 아이콘 */}
        <div style={{
          fontSize: '120px',
          marginBottom: '32px',
          transition: 'transform 0.3s',
          transform: status === 'scanning' ? 'scale(1.1)' : 'scale(1)'
        }}>
          {getStatusIcon()}
        </div>

        {/* 버튼 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {/* 등원 버튼 */}
          <button
            onClick={() => handleScan('entrance')}
            disabled={status === 'scanning' || !serverStatus.fingerprint || !serverStatus.backend}
            style={{
              padding: '48px 32px',
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: status === 'scanning' ? '#9ca3af' : '#10b981',
              border: 'none',
              borderRadius: '16px',
              cursor: status === 'scanning' ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              opacity: (!serverStatus.fingerprint || !serverStatus.backend) ? 0.5 : 1
            }}
          >
            🚪 등원
          </button>

          {/* 퇴장 버튼 */}
          <button
            onClick={() => handleScan('exit')}
            disabled={status === 'scanning' || !serverStatus.fingerprint || !serverStatus.backend}
            style={{
              padding: '48px 32px',
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'white',
              backgroundColor: status === 'scanning' ? '#9ca3af' : '#ef4444',
              border: 'none',
              borderRadius: '16px',
              cursor: status === 'scanning' ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              opacity: (!serverStatus.fingerprint || !serverStatus.backend) ? 0.5 : 1
            }}
          >
            👋 퇴장
          </button>
        </div>

        {/* 메시지 */}
        {message && (
          <div style={{
            padding: '24px',
            borderRadius: '12px',
            backgroundColor: status === 'error' ? '#fee2e2' : status === 'success' ? '#d1fae5' : '#dbeafe',
            border: `2px solid ${getStatusColor()}`,
            marginBottom: '16px'
          }}>
            <p style={{
              fontSize: '24px',
              fontWeight: '600',
              color: status === 'error' ? '#991b1b' : status === 'success' ? '#065f46' : '#1e40af',
              margin: 0
            }}>
              {message}
            </p>
          </div>
        )}

        {/* 학생 정보 */}
        {studentInfo && status === 'success' && (
          <div style={{
            padding: '24px',
            borderRadius: '12px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
              {actionType === 'entrance' ? '등원 학생' : '퇴장 학생'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111', marginBottom: '4px' }}>
              {studentInfo.name}
            </div>
            <div style={{ fontSize: '18px', color: '#6b7280' }}>
              {studentInfo.seat_number} | {studentInfo.status}
            </div>
          </div>
        )}

        {/* 서버 연결 안내 */}
        {(!serverStatus.fingerprint || !serverStatus.backend) && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#92400e'
          }}>
            ⚠️ 서버가 실행되지 않았습니다
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              {!serverStatus.fingerprint && <div>• 지문인식 서버: localhost:5000</div>}
              {!serverStatus.backend && <div>• 출석 서버: localhost:8000</div>}
            </div>
          </div>
        )}
      </div>

      {/* 하단 정보 */}
      <div style={{
        marginTop: '48px',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '14px'
      }}>
        <p>문제가 발생하면 관리자에게 문의하세요</p>
        <p style={{ marginTop: '8px' }}>
          현재 시간: {new Date().toLocaleString('ko-KR')}
        </p>
      </div>
    </div>
  );
}

export default KioskEntrance;
