import OpenAI from 'openai';
import { OPENAI_API_KEY } from '@config/env';
import { getCurrentLanguage } from '../i18n';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface FishAnalysis {
  isFish: boolean;
  species?: string;
  confidence: number;
  description?: string;
}

export async function analyzeFishImage(imageUri: string): Promise<FishAnalysis> {
  try {
    // 이미지를 base64로 인코딩
    const base64Image = await getBase64FromUri(imageUri);
    
    if (!base64Image) {
      throw new Error('이미지 인코딩 실패');
    }

    // 현재 선택된 언어 가져오기
    const currentLanguage = getCurrentLanguage();
    
    // 언어에 따른 프롬프트 설정
    let promptText = "";
    let errorMessage = "";
    
    switch (currentLanguage) {
      case 'ko':
        promptText = "이 이미지가 물고기인지 분석해주세요. 물고기라면 어떤 종인지, 특징은 무엇인지 한국어로 알려주세요. 반드시 다음 JSON 형식으로만 응답해주세요: { \"isFish\": boolean, \"species\": string, \"confidence\": number, \"description\": string }";
        errorMessage = "이미지 분석 중 오류가 발생했습니다. ";
        break;
      case 'zh':
        promptText = "请分析这张图片是否为鱼类。如果是鱼类，请用中文告诉我是什么品种，以及它的特征是什么。必须按照以下JSON格式回答: { \"isFish\": boolean, \"species\": string, \"confidence\": number, \"description\": string }";
        errorMessage = "图像分析期间发生错误。";
        break;
      default: // 'en'
        promptText = "Please analyze if this image is a fish. If it's a fish, tell me what species it is and its characteristics in English. Respond only in the following JSON format: { \"isFish\": boolean, \"species\": string, \"confidence\": number, \"description\": string }";
        errorMessage = "An error occurred during image analysis. ";
        break;
    }

    // OpenAI API 호출
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:image/jpeg;base64,${base64Image}`
              } 
            }
          ]
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    // 응답 내용 로깅
    const contentString = response.choices[0].message.content || '{}';
    console.log('OpenAI 응답:', contentString);
    
    try {
      // JSON 파싱 시도
      const result = JSON.parse(contentString);
      return {
        isFish: Boolean(result.isFish),
        species: result.species || undefined,
        confidence: Number(result.confidence) || 0,
        description: result.description || undefined
      };
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      
      // 응답 텍스트가 있는 경우 수동으로 파싱 시도
      if (contentString && typeof contentString === 'string') {
        // 기본 값으로 응답
        const isFishKeywords = {
          'ko': ['물고기', '해양생물', '어류'],
          'zh': ['鱼', '海洋生物', '水生动物'],
          'en': ['fish', 'marine', 'aquatic']
        };
        
        const keywords = isFishKeywords[currentLanguage as keyof typeof isFishKeywords] || isFishKeywords['en'];
        const isFish = keywords.some(keyword => contentString.toLowerCase().includes(keyword.toLowerCase()));
        
        // 언어에 따른 알 수 없음 메시지
        const unknownSpeciesMap = {
          'ko': '알 수 없음',
          'zh': '未知',
          'en': 'Unknown'
        };
        
        const unknownSpecies = unknownSpeciesMap[currentLanguage as keyof typeof unknownSpeciesMap] || 'Unknown';
        
        return {
          isFish,
          species: unknownSpecies,
          confidence: 0.5,
          description: contentString
        };
      }
      
      throw parseError;
    }
  } catch (error) {
    console.error('이미지 분석 중 오류 발생:', error);
    
    // 현재 언어에 따른 오류 메시지
    const errorPrefixMap = {
      'ko': '이미지 분석 중 오류가 발생했습니다. ',
      'zh': '图像分析期间发生错误。',
      'en': 'An error occurred during image analysis. '
    };
    
    const errorPrefix = errorPrefixMap[getCurrentLanguage() as keyof typeof errorPrefixMap] || 'An error occurred during image analysis. ';
    
    return {
      isFish: false,
      confidence: 0,
      description: errorPrefix + (error instanceof Error ? error.message : String(error))
    };
  }
}

// 이미지 URI에서 base64 데이터 추출
async function getBase64FromUri(uri: string): Promise<string | null> {
  try {
    // 이미지 데이터를 base64로 변환
    const response = await fetch(uri);
    const blob = await response.blob();
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        try {
          const base64 = reader.result as string;
          // data:image/jpeg;base64, 부분 제거
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => {
        reject(new Error('FileReader 오류 발생'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('이미지 인코딩 중 오류 발생:', error);
    return null;
  }
} 