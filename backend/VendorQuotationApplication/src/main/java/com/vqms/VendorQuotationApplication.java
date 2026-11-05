package com.vqms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@SpringBootApplication
public class VendorQuotationApplication {

	public static void main(String[] args) {
		SpringApplication.run(VendorQuotationApplication.class, args);
	}

}
