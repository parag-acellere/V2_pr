package subproject2;

import org.subproject2_A.App;

public class DemoSubproject2 { 

	int k;
	App app;
	
	public static void main(String[] args) {
		int k_subproject;
	}
	
	private static DemoSubproject2 fook = null;

	public static DemoSubproject2 getFook() { 
		 System.out.println("12312323"); 
		 
		if (fook==null) {
			fook = new DemoSubproject2();
		}                       
		return fook;
	}

	
	
	public static int getIntValue() {
	int k = 58; 
	return k;	
	}
	
	public void x(){
		try{
			
		 System.out.println("12312323"); 
		}
		catch(Exception ex){
			
		}
		
	}
	
}
